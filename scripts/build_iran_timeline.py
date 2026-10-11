"""Rebuild the portfolio timeline from the reviewed, versioned CSV extracts.

Run from the repository root: python scripts/build_iran_timeline.py
Only standard-library dependencies are required. Scores are frozen inputs,
not generated or imputed by this presentation build.
"""
import csv
import hashlib
import html
import json
import re
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path
from statistics import mean

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'projects/assets/political-text-analysis'
PAGE = ASSETS / 'trump-iran-connected-timeline.html'
FRAMES = ['Threat', 'Victory', 'Diplomacy', 'Ceasefire / Ending', 'Blame Allies', 'Media Criticism']
CSS = ['threat','victory','diplomacy','ceasefire','blame','media']
WINDOWS = {-1:'Day before',0:'Event day',1:'Day after'}

def read(name):
    with (ASSETS/name).open(encoding='utf-8',newline='') as f:
        return list(csv.DictReader(f))

def esc(value):
    return html.escape(str(value),quote=True)

def plain(value):
    return re.sub(r'\s+',' ',str(value)).strip()

def linked_text(text):
    return re.sub(r'https?://[^\s<>]+',lambda m:f'<a href="{m[0]}" target="_blank" rel="noopener noreferrer">{m[0]}</a>',esc(text))

def significance(rows):
    exact=[r for r in rows if r['date_start']==r['date_end']]
    best=sum(int(r['best']) for r in exact)
    civilian=sum(int(r['deaths_civilians']) for r in exact)
    level='major' if best>=25 or civilian>=10 else 'high' if best>=10 or len(exact)>=3 else 'notable' if best>=5 or len(exact)>=2 else 'standard' if exact else 'context'
    label={'standard':'Minor','context':'Multi-day Event'}.get(level,level.title())
    reason=f'{len(exact)} same-day UCDP records; best death estimate {best}; {civilian} civilian deaths' if exact else f'No same-day fatality record; {len(rows)} multi-day record starts here'
    return level,label,reason

def post_card(row,scores):
    text=plain(row['content_text'])
    values=scores[row['truth_id']]
    winner=max(FRAMES,key=lambda f:values[f])
    badge=CSS[FRAMES.index(winner)]
    bars=''.join(f'<div class="score-row"><span>{esc("Ceasefire" if f=="Ceasefire / Ending" else f)}</span><span class="score-track"><span class="fill {c}" style="width:{values[f]*100:.1f}%"></span></span><strong>{values[f]:.2f}</strong></div>' for f,c in zip(FRAMES,CSS))
    stamp=datetime.fromisoformat(row['created_at_et'])
    tz='EST' if stamp.utcoffset()==timedelta(hours=-5) else 'EDT'
    preview=text if len(text)<=360 else text[:360].rstrip()+'…'
    return f'''<details class="truth-card" data-truth-id="{esc(row['truth_id'])}"><summary>
<div class="truth-head"><div class="avatar">DJT</div><div class="identity"><div class="name">Donald J. Trump</div><div class="handle">@realDonaldTrump</div></div></div>
<span class="dominant-badge {badge}">{esc(winner)}</span><div class="preview">{linked_text(preview)}</div>
<div class="expanded-inline">{linked_text(text)}</div><div class="score-area">{bars}</div>
<div class="meta">{WINDOWS[int(row['relative_day'])]} · <time datetime="{esc(row['created_at_et'])}">{stamp:%Y-%m-%d %H:%M} {tz}</time></div>
<div class="read-more-cue"><span class="read-collapsed">Show full archived text ↓</span><span class="read-expanded">Hide full archived text ↑</span></div></summary>
<div class="full"><a class="truth-link" href="{esc(row['truth_url'])}" target="_blank" rel="noopener noreferrer">View original Truth Social post ↗</a></div></details>'''

def group(rows,scores,partial=False):
    note='<p class="coverage-note">Partial archive day: posts captured only through 08:09 EDT. Excluded from the aggregate comparison.</p>' if partial else ''
    if not rows:
        return note+'<div class="empty-posts">No matched Iran-related posts in this archive window. This is missing rhetoric evidence, not a zero score.</div>'
    return note+'<div class="post-scroll"><div class="post-track">'+''.join(post_card(r,scores) for r in sorted(rows,key=lambda r:r['created_at_et']))+'</div></div>'

def replace_one(text,pattern,replacement):
    text,count=re.subn(pattern,lambda m:replacement,text,count=1,flags=re.S)
    assert count==1, 'Missing template hook: '+pattern[:80]
    return text

def build():
    events=read('ucdp-us-involved-through-august-2026.csv')
    windows=read('post-event-windows-through-august-2026.csv')
    raw_scores=read('rhetoric-scores-through-august-2026.csv')
    manifest=json.loads((ASSETS/'refresh-provenance.json').read_text(encoding='utf-8'))
    for filename,record in manifest['files'].items():
        # Git may check text out with CRLF on Windows; verify canonical UTF-8/LF.
        canonical=(ASSETS/filename).read_text(encoding='utf-8').encode('utf-8')
        assert hashlib.sha256(canonical).hexdigest()==record['sha256_lf'], 'Source checksum mismatch: '+filename
    scores={r['truth_id']:{f:float(r[f]) for f in FRAMES} for r in raw_scores}
    assert len(scores)==len(raw_scores), 'Duplicate score IDs'
    assert len(events)==len({r['id'] for r in events}), 'Duplicate event IDs'
    assert len(windows)==len({(r['event_date'],r['truth_id']) for r in windows}), 'Duplicate post/event pairs'
    assert {r['truth_id'] for r in windows}<=scores.keys(), 'Missing scores'
    assert all(0<=v<=1 for row in scores.values() for v in row.values()), 'Invalid score'
    by_date=defaultdict(list)
    for r in events:
        assert r['date_start']<=r['date_end']
        assert r['country']=='Iran' and r['us_involvement'] in ['US','Joint US-Israel']
        assert int(r['low'])<=int(r['best'])<=int(r['high']) or r['id'] in manifest.get('upstream_quality_flags',{}), 'Unreviewed fatality interval inconsistency'
        by_date[r['date_start']].append(r)
    dates=sorted(by_date)
    cutoff=datetime.fromisoformat(manifest['archive_cutoff_utc'].replace('Z','+00:00'))
    # A fully observed day ends at midnight Eastern, with the post's own offset.
    def partial(day):
        # August snapshot ends in EDT; all older days are complete for this check.
        end=datetime.fromisoformat(day+'T00:00:00-04:00')+timedelta(days=1)
        return end>cutoff
    grouped=defaultdict(list)
    for r in windows:
        offset=int(r['relative_day'])
        assert offset in WINDOWS
        post_day=datetime.fromisoformat(r['created_at_et']).date()
        assert (post_day-date.fromisoformat(r['event_date'])).days==offset, 'Window/timestamp mismatch'
        grouped[(r['event_date'],offset)].append(r)
    summaries=[]
    event_html=[]
    nodes=[]
    means=defaultdict(list)
    for index,day in enumerate(dates):
        anchor=date.fromisoformat(day)
        level,label,reason=significance(by_date[day])
        subsets={k:grouped[(day,k)] for k in WINDOWS}
        row={'date':day,'label':label,'reason':reason,'windows':{}}
        for offset,posts in subsets.items():
            is_partial=partial((anchor+timedelta(days=offset)).isoformat())
            values={f:mean(scores[p['truth_id']][f] for p in posts) for f in FRAMES} if posts else None
            row['windows'][str(offset)]={'count':len(posts),'means':values,'partial':is_partial}
            if values and not is_partial:
                means[offset].append(values)
        summaries.append(row)
        evidence=by_date[day]
        headlines=list(dict.fromkeys(re.sub(r'^(?:Urgent:|(?:\d(?:st|nd|rd|th) )?LD Writethru:)\s*','',plain(e['involvement_evidence']),flags=re.I) for e in evidence))
        title=' · '.join(headlines[:2])
        if len(title)>230:title=title[:227]+'…'
        locations=' · '.join(dict.fromkeys(e['where_coordinates'] for e in evidence))
        records=''.join(f'<li><strong>UCDP {esc(e["id"])} · {esc(e["us_involvement"])}</strong><br>{esc(e["date_start"])} to {esc(e["date_end"])} · date precision {esc(e["date_prec"])} · coding: {esc(e["code_status"])}<br>Source fatalities: best {e["best"]}, low {e["low"]}, high {e["high"]}.<br>{esc(manifest.get("upstream_quality_flags",{}).get(e["id"],""))}<br>{esc(plain(e["source_headline"]))}</li>' for e in evidence)
        event_html.append(f'''<section class="event-view" data-event-index="{index}" data-event-date="{day}" aria-label="{anchor:%B %d, %Y}"><div class="event-stage"><div class="event-top"><div class="event-card"><div class="event-card-label">UCDP · U.S. INVOLVEMENT</div><div class="event-card-title">{esc(title)}</div><div class="event-card-meta">{esc(locations)}</div><span class="sig-pill {level}">{label} event day</span><div class="event-card-meta">{esc(reason)}</div><details class="event-evidence"><summary>Event records &amp; source headlines</summary><p>Candidate records are provisional. Multi-day fatality totals are not assigned to the first day.</p><ul>{records}</ul></details></div><div class="eventday-zone"><div class="eventday-label">Event day · {len(subsets[0])} posts</div>{group(subsets[0],scores,row['windows']['0']['partial'])}</div></div><div class="rail-wrap"><div class="rail-line"></div><div class="branch-node before-node"></div><div class="center-node {level}"></div><div class="branch-node after-node"></div><div class="before-date">{anchor-timedelta(days=1):%b %d}</div><div class="node-date">{anchor:%B %d, %Y}</div><div class="after-date">{anchor+timedelta(days=1):%b %d}</div></div><div class="branch-area"><div class="branch before-branch"><div class="branch-heading"><strong>Day before</strong><span>{len(subsets[-1])} posts</span></div>{group(subsets[-1],scores,row['windows']['-1']['partial'])}</div><div class="branch after-branch"><div class="branch-heading"><strong>Day after</strong><span>{len(subsets[1])} posts</span></div>{group(subsets[1],scores,row['windows']['1']['partial'])}</div></div></div></section>''')
        tip=f'{anchor:%B %d, %Y} — {label}: {reason}'
        nodes.append(f'<button class="timeline-node {level}" data-event-index="{index}" data-event-date="{day}" type="button" title="{esc(tip)}" aria-label="{esc(tip)}"><span class="timeline-dot"></span><span class="timeline-date">{anchor:%b %d}</span></button>')
    overall={str(k):{f:mean(x[f] for x in means[k]) for f in FRAMES} for k in WINDOWS}
    table='<table class="summary-table"><caption>Mean model scores across dates with matched posts; blank windows are omitted.</caption><thead><tr><th scope="col">Category</th>'+''.join(f'<th scope="col">{v}<small>{len(means[k])} dates with posts</small></th>' for k,v in WINDOWS.items())+'</tr></thead><tbody>'
    for frame,cls in zip(FRAMES,CSS):
        table+=f'<tr><th scope="row">{esc(frame)}</th>'
        for offset in WINDOWS:
            value=overall[str(offset)][frame]
            table+=f'<td><div class="summary-score"><span class="summary-track"><span class="summary-fill {cls}" style="width:{value*100:.1f}%"></span></span><strong>{value:.2f}</strong></div></td>'
        table+='</tr>'
    table+='</tbody></table>'
    text=PAGE.read_text(encoding='utf-8')
    # Remove the frozen 26-index color rules; one external controller now owns color.
    text=re.sub(r'<style id="rhetoric-timeline-colors">.*?</style>','',text,flags=re.S)
    text=replace_one(text,r'<h1 class="title toc-ignore">.*?</h1>','<h1 class="title toc-ignore">Trump’s Iran Rhetoric Around U.S.-Involved Conflict Events</h1>')
    text=replace_one(text,r'<title>.*?</title>','<title>Trump’s Iran Rhetoric Around U.S.-Involved Conflict Events</title>')
    text=replace_one(text,r'<(?:h3|p) class="subtitle">.*?</(?:h3|p)>','<p class="subtitle">Explore the posts before, during, and after U.S.-involved conflict events.</p>')
    text=replace_one(text,r'<p class="lede-question">.*?</p>','<p class="lede-question">How does Trump’s rhetoric differ before, during, and after recorded U.S.-involved lethal conflict events in Iran?</p>')
    text=re.sub(r'<section id="refresh-overview"[^>]*>.*?</section>','',text,flags=re.S)
    overview=f'''<section id="refresh-overview" aria-label="Dataset snapshot"><dl class="snapshot-stats"><div class="snapshot-stat"><dt>U.S.-involved event records</dt><dd>{len(events)}</dd></div><div class="snapshot-stat" title="Several UCDP records can share a start date; each distinct date has one timeline point."><dt>Distinct event start dates</dt><dd>{len(dates)}</dd></div><div class="snapshot-stat"><dt>Unique matched posts</dt><dd>{len(scores)}</dd></div></dl></section>'''
    text=replace_one(text,r'(<div class="writeup-cta">.*?</div>)',re.search(r'<div class="writeup-cta">.*?</div>',text,re.S)[0]+overview)
    text=replace_one(text,r'<table class="summary-table">.*?</table>',table)
    text=replace_one(text,r'<h2>(?:Event-balanced rhetorical comparison|Rhetoric around event dates)</h2>.*?(?=<div class="summary-scroll">)','<h2>Rhetoric around event dates</h2><p>Each date’s posts are averaged first, then those date means are averaged. Windows with no matched posts have no score. The incomplete August 31 window is excluded.</p>')
    text=re.sub(r'<div class="viewer-note">\s*(<p><strong>Connected timeline view\.</strong>.*?</p>)\s*</div>',r'<details class="viewer-note usage-note"><summary>How to use the timeline</summary>\1</details>',text,count=1,flags=re.S)
    text=text.replace('<div class="panel">\n<div class="panel-body">','<details class="panel summary-panel"><summary>Compare rhetoric around event dates</summary>\n<div class="panel-body">',1)
    text=re.sub(r'</div>\s*</div>\s*(?=<div class="viewer")','</div>\n</details>\n',text,count=1)
    stages=list(re.finditer(r'<section class="event-view".*?</section>',text,re.S))
    assert stages
    text=text[:stages[0].start()]+''.join(event_html)+text[stages[-1].end():]
    text=replace_one(text,r'<select id="eventSelect"[^>]*>.*?</select>','<select id="eventSelect" aria-label="Choose an event date">'+''.join(f'<option value="{i}">{date.fromisoformat(d):%B %d, %Y}</option>' for i,d in enumerate(dates))+'</select>')
    text=replace_one(text,r'<strong class="event-counter" id="eventCounter"[^>]*>.*?</strong>',f'<strong class="event-counter" id="eventCounter" aria-live="polite">1 of {len(dates)}</strong>')
    text=replace_one(text,r'<span class="toolbar-note">.*?</span>','<span class="toolbar-note">Size = same-day event severity; color window is selectable below</span>')
    text=text.replace('<div class="viewer">','<div class="viewer" id="event-explorer">',1) if 'id="event-explorer"' not in text else text
    markers=list(re.finditer(r'<button[^>]*class="timeline-node [^"]+".*?</button>',text,re.S))
    assert markers
    text=text[:markers[0].start()]+''.join(nodes)+text[markers[-1].end():]
    text=text.replace('No tweet scored on event day','No posts in selected window')
    text=replace_one(text,r'<details class="rhetoric-color-note">.*?</details>','<details class="rhetoric-color-note"><summary>How to read the bubbles</summary><p>Color shows the highest mean category in the selected post window; it does not measure the chance of intervention. Gray means no matched posts. Exact ties split colors evenly. Size describes same-day fatalities and record count; multi-day totals are not assigned to their start date.</p></details>')
    text=re.sub(r'<div id="color-window-controls">.*?</div>','',text,flags=re.S)
    text=text.replace('<div class="timeline-key-row">','<div id="color-window-controls"><label for="colorWindow">Color bubbles by posts from</label><select id="colorWindow"><option value="-1">Day before</option><option value="0">Event day</option><option value="1">Day after</option></select><span id="colorWindowNote" aria-live="polite"></span></div><div class="timeline-key-row">',1)
    # Open the before window by default on mobile as the first chronological window.
    text=text.replace('stage,\n      "dayof"','stage,\n      "before"')
    text=re.sub(r'<script id="timeline-reviewed-data".*?</script>','',text,flags=re.S)
    text=re.sub(r'<script src="timeline-refresh.js"></script>','',text)
    text=re.sub(r'\n?<link rel="stylesheet" href="timeline-refresh.css"/>','',text)
    text=text.replace('</head>','<link rel="stylesheet" href="timeline-refresh.css"/>\n</head>',1)
    # The legacy template also has styles after its first head block.
    # Load our final stylesheet again last to ensure responsive overrides win.
    data=json.dumps({'events':summaries,'frames':FRAMES,'overall':overall},ensure_ascii=False).replace('</','<\\/')
    text=text.replace('</body>',f'<link rel="stylesheet" href="timeline-refresh.css"/><script id="timeline-reviewed-data" type="application/json">{data}</script><script src="timeline-refresh.js"></script>\n</body>',1)
    text=re.sub(r'\n{3,}','\n\n',text)
    PAGE.write_text(text,encoding='utf-8',newline='\n')
    (ASSETS/'comparison-results.json').write_text(json.dumps({'overall':overall,'window_event_counts':{str(k):len(means[k]) for k in WINDOWS},'events':summaries},indent=2),encoding='utf-8')
    print(json.dumps({'events':len(events),'dates':len(dates),'posts':len(scores),'window_rows':len(windows),'mean_threat':{k:v['Threat'] for k,v in overall.items()},'denominators':{str(k):len(means[k]) for k in WINDOWS}},indent=2))

if __name__=='__main__':
    build()
