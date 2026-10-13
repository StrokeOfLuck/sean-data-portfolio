"""Presentation and descriptive severity checks for the reviewed timeline."""
import html
import math
import re
from statistics import mean

COLORS = ['#9a4949', '#4e7657', '#4b719c', '#7d6594', '#b5752e', '#2f8f95']


def ranks(values):
    ordered = sorted(set(values))
    return [1 + sum(x < v for x in values) + (values.count(v) - 1) / 2 for v in values]


def spearman(rows, frame):
    if len(rows) < 3:
        return None
    x = ranks([r['fatalities'] for r in rows])
    y = ranks([r['means'][frame] for r in rows])
    dx, dy = [v - mean(x) for v in x], [v - mean(y) for v in y]
    denominator = math.sqrt(sum(v*v for v in dx) * sum(v*v for v in dy))
    return sum(a*b for a,b in zip(dx,dy)) / denominator if denominator else None


def severity_data(summaries, frames):
    result = {}
    for offset in ['-1', '0', '1']:
        rows = [dict(date=e['date'], index=i, fatalities=e['same_day_fatalities'],
                     low=e['same_day_low'], high=e['same_day_high'],
                     count=e['windows'][offset]['count'], means=e['windows'][offset]['means'])
                for i,e in enumerate(summaries)
                if e['same_day_records'] and e['windows'][offset]['means']
                and not e['windows'][offset]['partial']]
        without_largest = [r for r in rows if r['date'] != '2026-02-28']
        result[offset] = dict(rows=rows, n=len(rows),
                              spearman={f:spearman(rows,f) for f in frames},
                              without_largest_spearman={f:spearman(without_largest,f) for f in frames})
    return result


def element_span(text, opening):
    """Locate a div and its balanced closing tag without consuming siblings."""
    start = text.index(opening)
    depth = 0
    for token in re.finditer(r'<div\b[^>]*>|</div\s*>', text[start:], re.I):
        depth += -1 if token.group().startswith('</') else 1
        if depth == 0:
            return start, start + token.end()
    raise ValueError('Unbalanced container: ' + opening)


def connected_dots(overall, frames, counts):
    charts = []
    for i, frame in enumerate(frames):
        values = [overall[str(k)][frame] for k in [-1,0,1]]
        points = [(48+j*114, 176-v*140) for j,v in enumerate(values)]
        grid = ''.join(f'<line x1="48" x2="276" y1="{176-t*140}" y2="{176-t*140}" class="chart-grid"/>' + (f'<text x="37" y="{180-t*140}" text-anchor="end">{t:g}</text>' if t != .5 else '') for t in [0,.5,1])
        marks = f'<polyline points="{" ".join(f"{x},{y}" for x,y in points)}" fill="none" stroke="{COLORS[i]}" stroke-width="2.5"/>'
        for (x,y),v,label in zip(points,values,['Before','Event day','After']):
            marks += f'<circle cx="{x}" cy="{y}" r="5" fill="{COLORS[i]}"/><text x="{x}" y="{y-13}" text-anchor="middle" class="chart-value">{v:.2f}</text><text x="{x}" y="203" text-anchor="middle">{label}</text>'
        charts.append(f'<figure class="comparison-small"><figcaption>{html.escape(frame)}</figcaption><svg viewBox="0 0 324 222" role="img" aria-label="{html.escape(frame)}: before {values[0]:.3f}, event day {values[1]:.3f}, after {values[2]:.3f}. Mean model score on a 0 to 1 scale.">{grid}{marks}</svg></figure>')
    return '<div class="comparison-grid">' + ''.join(charts) + '</div>' + '<p class="chart-footnote">Mean model score (0–1). Before: '+str(counts[-1])+' dates; event day: '+str(counts[0])+'; after: '+str(counts[1])+'. These are different available-date samples, not a paired change estimate. Connecting lines guide the eye.</p>'


def apply_feedback(text, summaries, overall, frames, counts, record_count, post_count):
    start,end = element_span(text, '<div class="summary-scroll">')
    table = re.search(r'<table class="summary-table">.*?</table>', text[start:end], re.S).group()
    text = text[:start] + '<div class="summary-scroll">' + connected_dots(overall,frames,counts) + '<details class="comparison-values"><summary>View exact values and sample sizes</summary>'+table+'</details></div>' + text[end:]
    text = re.sub(r'<p class="intro-help">.*?</p>', '<p class="intro-help">This selected sample contains '+str(record_count)+' provisional UCDP records of lethal organized violence in Iran, grouped into '+str(len(summaries))+' start dates from February 28 to August 30, 2026. Inclusion requires documented U.S. or joint U.S.–Israel action, including one U.S. operation-context record with an unspecified strike actor. A bubble is a date group, not one attack.</p><p class="intro-help">Posts are matched to the day before, the start date, and the day after using Eastern Time. The UCDP releases cover through August 31; the post archive ends August 31 at 08:09 EDT. Multi-day records are anchored to their start date, not reduced to a one-day event. Click a timeline bubble to see the records and posts directly below it.</p>', text, count=1, flags=re.S)
    # Keep one navigation area, immediately before the selected date's evidence.
    start,end = element_span(text, '<div class="global-timeline">')
    timeline = text[start:end]
    text = text[:start] + text[end:]
    start,end = element_span(text, '<div class="viewer-toolbar">')
    toolbar = '<div class="viewer-toolbar"><div class="event-step-buttons"><button id="prevEvent" type="button">← Previous event</button><button id="nextEvent" type="button">Next event →</button></div><h2 class="selected-event-heading" id="selected-event-heading" tabindex="-1">Selected event date</h2><div id="event-record-controls"></div><strong class="event-counter" id="eventCounter" aria-live="polite">1 of '+str(len(summaries))+'</strong></div>'
    text = text[:start] + timeline + toolbar + re.sub(r'<h2 class="selected-event-heading"[^>]*>.*?</h2>', '', text[end:], flags=re.S)
    # Remove prior severity section on a repeated build.
    text = re.sub(r'<section id="severity-analysis".*?</section>', '', text, flags=re.S)
    text = re.sub(r'<dialog id="event-records-dialog".*?</dialog>', '', text, flags=re.S)
    section = '''<section id="severity-analysis" class="panel" aria-labelledby="severity-title"><div class="panel-body">
<h2 id="severity-title">Event severity and rhetoric</h2>
<p>Do higher-fatality dates coincide with different rhetoric? Each dot is one date with same-day UCDP records and matched posts. The four panels share the same axes.</p>
<div class="severity-controls"><label for="severityWindow">Post window</label><select id="severityWindow"><option value="-1">Day before</option><option value="0" selected>Event day</option><option value="1">Day after</option></select><label><input id="severityExcludeLargest" type="checkbox"> Check sensitivity: exclude February 28 (162 deaths)</label></div>
<p id="severity-summary" aria-live="polite"></p><div id="severity-charts" class="severity-grid"></div>
<div id="severity-tooltip" role="status" hidden></div>
<p class="chart-footnote">Horizontal axis: summed UCDP best fatality estimate for same-day records, on a log scale (ticks show deaths). Vertical axis: mean post score, 0–1. Horizontal whiskers show summed UCDP low–high estimates, not statistical confidence intervals. Multi-day totals, empty post windows, and partial archive days are excluded. Bubble size above also uses record count and civilian deaths; this comparison isolates total fatalities.</p>
<p class="chart-footnote">Spearman ρ describes rank association within the displayed sample. Small, selected samples and overlapping post windows do not support a causal or predictive claim. Event-day posts cannot establish whether rhetoric preceded an attack.</p>
<details><summary>Inspect plotted dates and values</summary><div class="severity-table-wrap" tabindex="0" role="region" aria-label="Severity data table; scroll horizontally"><table id="severity-values" class="summary-table"></table></div><p><a href="severity-results.json" download>Download all severity checks (JSON)</a> · <a href="ucdp-us-involved-through-august-2026.csv" download>UCDP records (CSV)</a> · <a href="post-event-windows-through-august-2026.csv" download>Post windows (CSV)</a></p></details>
</div></section>'''
    # The first script after the viewer is the retained navigation controller.
    at = text.index('<script>', text.index('<div class="viewer"'))
    text = text[:at] + section + text[at:]
    return text
