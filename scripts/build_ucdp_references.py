"""Build the source-selection reference data from frozen UCDP extracts.

python scripts/build_ucdp_references.py
To reconstruct the source pool from official downloaded CSVs, also pass
--source-dir PATH. Downloads must match refresh-provenance.json checksums.
"""
import argparse
import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'projects/assets/political-text-analysis'
POOL = ASSETS / 'ucdp-iran-source-pool-through-august-2026.csv'
EXTRACT = ASSETS / 'ucdp-us-involved-through-august-2026.csv'
PROVENANCE = ASSETS / 'refresh-provenance.json'
EXTRA = ['ucdp_release', 'included_in_current_timeline', 'selection_note']

def read(path):
    with path.open(encoding='utf-8-sig', newline='') as file:
        reader = csv.DictReader(file)
        return reader.fieldnames, list(reader)

def build(source_dir=None):
    manifest = json.loads(PROVENANCE.read_text(encoding='utf-8'))
    used_columns, used = read(EXTRACT)
    by_id = {r['id']: r for r in used}
    assert len(by_id) == len(used) == 48
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
            row['selection_note'] = ('Selected: ' + by_id[row['id']]['involvement_evidence']) if selected else 'Not retained in the reviewed U.S.-involved subset. Inspect the source headline to audit attribution.'
        with POOL.open('w', encoding='utf-8', newline='') as file:
            writer = csv.DictWriter(file, fieldnames=source_columns+EXTRA, lineterminator='\n')
            writer.writeheader()
            writer.writerows(source_rows)
    source_columns, source_rows = read(POOL)
    source_ids = {row['id'] for row in source_rows}
    selected_ids = {row['id'] for row in source_rows if row['included_in_current_timeline'] == 'Yes'}
    assert len(source_ids) == len(source_rows) == 80
    assert selected_ids == set(by_id), 'Reference selection must exactly match the timeline extract'
    assert all(row['country'] == 'Iran' and row['conflict_new_id'] == '16905' for row in source_rows)
    assert all(row['date_start'][:4] == '2026' for row in source_rows)
    assert max(row['date_start'][:10] for row in source_rows) == '2026-08-30'
    used = sorted(used, key=lambda r: (r['date_start'], int(r['id'])))
    payload = {
        'scope': 'Country Iran; UCDP conflict_new_id 16905; official Candidate releases January–June, July, and August 2026.',
        'counts': {'source': len(source_rows), 'used': len(used), 'excluded': len(source_rows)-len(used), 'usedStartDates': len({r['date_start'] for r in used})},
        'sources': manifest['ucdp_sources'],
        'sourceColumns': source_columns, 'usedColumns': used_columns,
        'source': source_rows, 'used': used,
        'qualityFlags': manifest.get('upstream_quality_flags', {}),
    }
    (ASSETS/'ucdp-reference-data.json').write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':'))+'\n', encoding='utf-8')
    manifest['reference_source_pool'] = {
        'scope': payload['scope'], 'counts': payload['counts'],
        'filename': POOL.name,
        'sha256_lf': hashlib.sha256(POOL.read_text(encoding='utf-8').encode('utf-8')).hexdigest(),
        'selection': 'Included rows are matched by persistent UCDP id to the reviewed timeline extract; excluded rows are marked without inventing individual exclusion reasons.',
    }
    PROVENANCE.write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(payload['counts']))

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-dir', type=Path)
    args = parser.parse_args()
    build(args.source_dir)
