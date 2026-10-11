'use strict';
(async function () {
  const usedMode = new URLSearchParams(location.search).get('view') === 'used';
  const get = id => document.getElementById(id);
  const data = await fetch('ucdp-reference-data.json').then(response => { if (!response.ok) throw new Error('Reference data could not be loaded'); return response.json(); });
  const rows = usedMode ? data.used : data.source;
  const columns = usedMode ? data.usedColumns : data.sourceColumns;
  let filtered = rows, page = 0;
  const pageSize = 15;
  get('viewTitle').textContent = usedMode ? 'Records used in the current timeline' : 'Filtered Iran conflict records';
  get('viewSummary').textContent = usedMode ? `${data.counts.used} selected records across ${data.counts.usedStartDates} start dates · January–August 2026` : `${data.counts.source} records in Iran, conflict 16905 · ${data.counts.used} included · ${data.counts.excluded} outside the reviewed subset · January–August 2026`;
  get('selectionControl').hidden = usedMode;
  get('export').href=usedMode?'ucdp-us-involved-through-august-2026.csv':'ucdp-iran-source-pool-through-august-2026.csv';
  get('export').textContent=usedMode?`Download all ${data.counts.used} used records (CSV)`:`Download ${data.counts.source} filtered records (CSV)`;
  get('selectionHeading').textContent = usedMode ? 'U.S. involvement' : 'Selection';
  get('tableCaption').textContent = usedMode ? 'Exact reviewed UCDP records used by the current timeline' : 'Official Iran-conflict source pool with timeline selection marked';
  if (usedMode) get('legend').textContent = 'These record IDs exactly match the current timeline extract. Click an ID to inspect all fields.';
  else {
    get('legend').innerHTML = '<span class="swatch included"></span>Yellow: extracted for the timeline. <span class="swatch excluded"></span>Gray: outside the reviewed subset. Click an ID to inspect the source.';
  }
  const included = row => usedMode || row.included_in_current_timeline === 'Yes';
  const normalizeRelease = value => value.includes('26.01.26.06') ? '26.01.26.06' : value.includes('26.0.7') ? '26.0.7' : '26.0.8';
  const date = value => value.slice(0,10);
  function cell(text) { const td=document.createElement('td'); td.textContent=text; return td; }
  function inspect(row) {
    get('recordBrowser').hidden=true; get('inspector').hidden=false;
    get('recordTitle').textContent=`UCDP ${row.id} · ${date(row.date_start)}`;
    const flag=data.qualityFlags[row.id];
    get('recordNote').textContent=(included(row) ? (usedMode ? `Used in the timeline. Attribution: ${row.us_involvement}. ${row.involvement_evidence}` : row.selection_note) : row.selection_note) + (row.date_start !== row.date_end ? ' This is a multi-day record; its fatality total is not assigned to the start date.' : '') + (flag ? ' Source caution: '+flag : '');
    const fields=get('recordFields'); fields.replaceChildren();
    for (const key of columns) {
      const item=document.createElement('div'); item.className='field';
      const label=document.createElement('dt'); label.textContent=key;
      const value=document.createElement('dd'); value.textContent=row[key] || '—';
      item.append(label,value); fields.append(item);
    }
    get('back').focus();
  }
  function render() {
    const body=get('records'); body.replaceChildren();
    for (const row of filtered.slice(page*pageSize,(page+1)*pageSize)) {
      const tr=document.createElement('tr');
      if (!usedMode) tr.className=included(row)?'included':'excluded';
      const status=cell(''); const statusText=document.createElement('span'); statusText.className='status';
      statusText.textContent=usedMode?row.us_involvement:included(row)?'Included':'Excluded';
      const note=document.createElement('span'); note.className='status-note'; note.textContent=normalizeRelease(row.ucdp_release)==='26.0.8'?'August release':normalizeRelease(row.ucdp_release)==='26.0.7'?'July release':'January–June release';
      status.append(statusText,note); tr.append(status);
      const id=cell(''); const button=document.createElement('button'); button.type='button'; button.textContent=row.id; button.setAttribute('aria-label','Inspect UCDP record '+row.id); button.addEventListener('click',()=>inspect(row)); id.append(button); tr.append(id);
      tr.append(cell(date(row.date_start)),cell(date(row.date_end)),cell(row.where_coordinates),cell(Number(row.best).toLocaleString('en-US')));
      const headline=cell(''); const text=document.createElement('span'); text.className='headline'; text.textContent=row.source_headline.replace(/\s+/g,' '); headline.append(text); tr.append(headline); body.append(tr);
    }
    if (!filtered.length) { const tr=document.createElement('tr'); const td=cell('No records match these filters.'); td.colSpan=7; tr.append(td); body.append(tr); }
    const pages=Math.max(1,Math.ceil(filtered.length/pageSize));
    get('resultCount').textContent=`${filtered.length} matching record${filtered.length===1?'':'s'} of ${rows.length}`;
    get('pageCount').textContent=`${page+1} / ${pages}`;
    get('previous').disabled=page===0; get('next').disabled=page+1>=pages;
  }
  function filter() {
    const query=get('search').value.trim().toLowerCase(), release=get('release').value, selection=get('selection').value;
    filtered=rows.filter(row=>(release==='all'||normalizeRelease(row.ucdp_release)===release)&&(usedMode||selection==='all'||(selection==='included' ? included(row) : !included(row)))&&(!query||Object.values(row).some(value=>String(value).toLowerCase().includes(query))));
    page=0; render();
  }
  for (const id of ['search','release','selection']) get(id).addEventListener(id==='search'?'input':'change',filter);
  get('previous').addEventListener('click',()=>{page--;render();});
  get('next').addEventListener('click',()=>{page++;render();});
  get('back').addEventListener('click',()=>{get('inspector').hidden=true;get('recordBrowser').hidden=false;get('search').focus();});
  render();
})().catch(error => {document.getElementById('viewSummary').textContent='The reference data could not load. Use the CSV and Excel downloads below, or open this viewer from the website.';console.error(error);});
