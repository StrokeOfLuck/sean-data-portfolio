"""Run with: python scripts/test_iran_timeline.py (after the timeline build)."""
import csv
import json
import re
import unittest
from collections import defaultdict
from pathlib import Path
from statistics import correlation

from iran_timeline_feedback import ranks, spearman

ASSETS = Path(__file__).resolve().parents[1] / 'projects/assets/political-text-analysis'


class TimelineEvidenceTests(unittest.TestCase):
    def test_rank_ties_and_degenerate_sample(self):
        self.assertEqual(ranks([3, 1, 1, 7]), [3, 1.5, 1.5, 4])
        self.assertIsNone(spearman([{'fatalities': 1, 'means': {'x': v}} for v in [1,2,3]], 'x'))

    def test_all_plotted_values_against_source_rows(self):
        def read(name):
            with (ASSETS / name).open(encoding='utf-8', newline='') as f:
                return list(csv.DictReader(f))
        events = read('ucdp-us-involved-through-august-2026.csv')
        windows = read('post-event-windows-through-august-2026.csv')
        scores = {r['truth_id']: r for r in read('rhetoric-scores-through-august-2026.csv')}
        result = json.loads((ASSETS/'severity-results.json').read_text())
        by_date, pairs = defaultdict(list), defaultdict(list)
        for r in events:
            if r['date_start'] == r['date_end']:
                by_date[r['date_start']].append(r)
        for r in windows:
            # August 31 is incomplete in the frozen archive.
            if not r['created_at_et'].startswith('2026-08-31'):
                pairs[(r['relative_day'], r['event_date'])].append(r['truth_id'])
        for offset, window in result.items():
            expected = {day for off,day in pairs if off == offset and day in by_date}
            self.assertEqual(expected, {r['date'] for r in window['rows']})
            self.assertEqual(window['n'], len(expected))
            for row in window['rows']:
                ids = pairs[(offset,row['date'])]
                self.assertEqual(len(ids), row['count'])
                for field, source in [('fatalities','best'),('low','low'),('high','high')]:
                    self.assertEqual(row[field], sum(int(r[source]) for r in by_date[row['date']]))
                for frame, value in row['means'].items():
                    self.assertAlmostEqual(value, sum(float(scores[id][frame]) for id in ids)/len(ids))
            # Independently ranked Pearson correlation verifies the displayed Spearman values.
            def independent_ranks(values):
                positions = defaultdict(list)
                for i, v in enumerate(sorted(values), 1):
                    positions[v].append(i)
                return [sum(positions[v])/len(positions[v]) for v in values]
            for key, rows in [('spearman',window['rows']),('without_largest_spearman',[r for r in window['rows'] if r['date']!='2026-02-28'])]:
                for frame, value in window[key].items():
                    actual = correlation(independent_ranks([r['fatalities'] for r in rows]), independent_ranks([r['means'][frame] for r in rows]))
                    self.assertAlmostEqual(value, actual)

    def test_navigation_and_chart_structure(self):
        page=(ASSETS/'trump-iran-connected-timeline.html').read_text(encoding='utf-8')
        self.assertNotIn('<select id="eventSelect"',page)
        self.assertEqual(len(re.findall(r'<figure class="comparison-small">',page)),6)
        self.assertEqual(page.count('<div class="global-timeline">'),1)
        self.assertEqual(page.count('id="selected-event-heading"'),1)
        self.assertEqual(page.count('id="severity-analysis"'),1)
        self.assertLess(page.index('<div class="global-timeline">'),page.index('<div id="eventViews">'))
        self.assertEqual(len(re.findall(r'<section class="event-view"',page)),28)


if __name__ == '__main__':
    unittest.main()
