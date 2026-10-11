"""Build the source-selection reference data from frozen UCDP extracts.

python scripts/build_ucdp_references.py
To reconstruct the source pool from official downloaded CSVs, also pass
--source-dir PATH. Downloads must match refresh-provenance.json checksums.
"""
import argparse
import csv
import hashlib
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'projects/assets/political-text-analysis'
POOL = ASSETS / 'ucdp-iran-source-pool-through-august-2026.csv'
EXTRACT = ASSETS / 'ucdp-us-involved-through-august-2026.csv'
PROVENANCE = ASSETS / 'refresh-provenance.json'
EXTRA = ['ucdp_release', 'included_in_current_timeline', 'selection_note']
REVIEW = ASSETS / 'ucdp-selection-review.json'
IRAN = ASSETS / 'ucdp-all-iran-through-august-2026.csv'
DATE_GROUPS = ASSETS / 'ucdp-event-start-date-groups-through-august-2026.csv'

def read(path):
    with path.open(encoding='utf-8-sig', newline='') as file:
        reader = csv.DictReader(file)
        return reader.fieldnames, list(reader)

def export_steps(manifest, used, source_dir):
    iran = {}
    source_columns = None
    for source in manifest['ucdp_sources']:
        path = source_dir / source['url'].split('/')[-1]
        assert hashlib.sha256(path.read_bytes()).hexdigest() == source['sha256'], f'Official source checksum mismatch: {path.name}'
        columns, rows = read(path)
        assert source_columns is None or columns == source_columns, 'Official release schema changed'
        source_columns = columns
        for row in rows:
            if row['country'] == 'Iran':
                iran[row['id']] = {**row, 'ucdp_release': source['version']}
    assert len(iran) == 172
    with IRAN.open('w', encoding='utf-8', newline='') as file:
        writer = csv.DictWriter(file, fieldnames=source_columns+['ucdp_release'], lineterminator='\n')
        writer.writeheader()
        writer.writerows(sorted(iran.values(), key=lambda row: (row['date_start'], int(row['id']))))
    groups = defaultdict(list)
    for row in used:
        groups[row['date_start']].append(row)
    group_rows = []
    for day, rows in sorted(groups.items()):
        same_day = sum(row['date_start'] == row['date_end'] for row in rows)
        group_rows.append({
            'event_start_date': day,
            'record_count': len(rows),
            'ucdp_ids': '; '.join(row['id'] for row in sorted(rows, key=lambda row: int(row['id']))),
            'same_day_record_count': same_day,
            'multi_day_record_count': len(rows)-same_day,
        })
    assert len(group_rows) == manifest['counts']['ucdp_start_dates']
    assert sum(row['record_count'] for row in group_rows) == len(used)
    with DATE_GROUPS.open('w', encoding='utf-8', newline='') as file:
        writer = csv.DictWriter(file, fieldnames=list(group_rows[0]), lineterminator='\n')
        writer.writeheader()
        writer.writerows(group_rows)
    return {
        'iran_records': {'filename': IRAN.name, 'records': len(iran), 'scope': 'All records with country Iran across the three official releases; all original UCDP fields plus the source release.'},
        'start_date_groups': {'filename': DATE_GROUPS.name, 'rows': len(group_rows), 'underlying_records': len(used), 'scope': 'One row per selected start date, with the complete member-ID list and same-day/multi-day record counts. No selected records are discarded.'},
    }

def build(source_dir=None):
    manifest = json.loads(PROVENANCE.read_text(encoding='utf-8'))
    review = json.loads(REVIEW.read_text(encoding='utf-8'))
    assert hashlib.sha256(REVIEW.read_text(encoding='utf-8').encode('utf-8')).hexdigest() == manifest['selection_review']['sha256_lf']
    decisions = review['decisions']
    used_columns, used = read(EXTRACT)
    by_id = {r['id']: r for r in used}
    assert len(by_id) == len(used) == manifest['counts']['ucdp_records']
    if source_dir:
        pool = {}
        for source in manifest['ucdp_sources']:
            file = source_dir / source['url'].split('/')[-1]
            assert hashlib.sha256(file.read_bytes()).hexdigest() == source['sha256'], f'Official source checksum mismatch: {file.name}'
            source_columns, rows = read(file)
            for row in rows:
                if row['country'] == 'Iran' and row['conflict_new_id'] == '16905':
                    # Keep the later release if a persistent ID occurs again.
                    pool[row['id']] = {**row, 'ucdp_release': source['version']}
        source_rows = sorted(pool.values(), key=lambda r: (r['date_start'], int(r['id'])))
        for row in source_rows:
            selected = row['id'] in by_id
            row['included_in_current_timeline'] = 'Yes' if selected else 'No'
            decision = decisions[row['id']]
            assert decision['included'] == selected, 'Selection review does not match extract: ' + row['id']
            row['selection_note'] = decision['reason']
        with POOL.open('w', encoding='utf-8', newline='') as file:
            writer = csv.DictWriter(file, fieldnames=source_columns+EXTRA, lineterminator='\n')
            writer.writeheader()
            writer.writerows(source_rows)
    source_columns, source_rows = read(POOL)
    source_ids = {row['id'] for row in source_rows}
    selected_ids = {row['id'] for row in source_rows if row['included_in_current_timeline'] == 'Yes'}
    assert len(source_ids) == len(source_rows) == 80
    assert selected_ids == set(by_id), 'Reference selection must exactly match the timeline extract'
    assert source_ids == set(decisions), 'Every source record must have a documented current decision'
    assert all(row['selection_note'] == decisions[row['id']]['reason'] for row in source_rows)
    assert all(row['country'] == 'Iran' and row['conflict_new_id'] == '16905' for row in source_rows)
    assert all(row['date_start'][:4] == '2026' for row in source_rows)
    assert max(row['date_start'][:10] for row in source_rows) == '2026-08-30'
    used = sorted(used, key=lambda r: (r['date_start'], int(r['id'])))
    steps = export_steps(manifest, used, source_dir or ASSETS/'ucdp-official')
    for record in steps.values():
        record['sha256_lf'] = hashlib.sha256((ASSETS/record['filename']).read_text(encoding='utf-8').encode('utf-8')).hexdigest()
    manifest['selection_step_exports'] = steps
    payload = {
        'scope': 'Country Iran; UCDP conflict_new_id 16905; official Candidate releases January–June, July, and August 2026.',
        'counts': {'source': len(source_rows), 'used': len(used), 'excluded': len(source_rows)-len(used), 'usedStartDates': len({r['date_start'] for r in used})},
        'sources': manifest['ucdp_sources'],
        'sourceColumns': source_columns, 'usedColumns': used_columns,
        'source': source_rows, 'used': used,
        'qualityFlags': manifest.get('upstream_quality_flags', {}),
        'selectionReview': review,
    }
    (ASSETS/'ucdp-reference-data.json').write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':'))+'\n', encoding='utf-8')
    manifest['reference_source_pool'] = {
        'scope': payload['scope'], 'counts': payload['counts'],
        'filename': POOL.name,
        'sha256_lf': hashlib.sha256(POOL.read_text(encoding='utf-8').encode('utf-8')).hexdigest(),
        'selection': 'Current decisions for all 80 records are documented in ucdp-selection-review.json. Reasons describe the October 11 review, not undocumented historical exclusions. Unverified U.S. involvement is not proof of absence.',
    }
    PROVENANCE.write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(payload['counts']))

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-dir', type=Path)
    args = parser.parse_args()
    build(args.source_dir)
