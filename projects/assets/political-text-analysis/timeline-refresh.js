/* Color is derived from reviewed scores for the selected window. */
(() => {
  'use strict';
  const data = JSON.parse(document.getElementById('timeline-reviewed-data').textContent);
  const control = document.getElementById('colorWindow');
  const colors = ['#9a4949','#4e7657','#4b719c','#7d6594','#b5752e','#2f8f95'];
  const names = {'-1':'Day before','0':'Event day','1':'Day after'};
  const style = document.createElement('style');
  document.head.appendChild(style);
  function updateColors() {
    const rules = [];
    let hasTies = false;
    data.events.forEach((event,index) => {
      const window = event.windows[control.value];
      const sorted = window.means ? data.frames.map((name,i) => ({name,i,value:window.means[name]})).sort((a,b)=>b.value-a.value) : [];
      const leaders = sorted.filter(x => Math.abs(x.value-sorted[0].value)<1e-12);
      if(leaders.length>1) hasTies = true;
      let fill = leaders.length ? colors[leaders[0].i] : '#89919a';
      const root=document.querySelector('.svg-timeline');
      if(leaders.length>1 && root) {
        const id=`rhetoric-split-${index}-${Number(control.value)+1}`;
        if(!root.querySelector(`#${id}`)) {
          const ns='http://www.w3.org/2000/svg';
          let defs=root.querySelector('defs');
          if(!defs) { defs=document.createElementNS(ns,'defs'); root.prepend(defs); }
          const gradient=document.createElementNS(ns,'linearGradient');
          gradient.id=id;
          leaders.forEach((leader,i)=>{
            [i/leaders.length,(i+1)/leaders.length].forEach(offset=>{
              const stop=document.createElementNS(ns,'stop');
              stop.setAttribute('offset',`${offset*100}%`);
              stop.setAttribute('stop-color',colors[leader.i]);
              gradient.appendChild(stop);
            });
          });
          defs.appendChild(gradient);
        }
        fill=`url(#${id})`;
      }
      const background = leaders.length>1 ? `conic-gradient(${leaders.map((x,i)=>`${colors[x.i]} ${i*100/leaders.length}% ${(i+1)*100/leaders.length}%`).join(',')})` : fill;
      const description = `${event.date} — ${event.label}: ${event.reason} | ${names[control.value]}: ` + (sorted.length ? `${sorted[0].name} ${sorted[0].value.toFixed(3)}; ${sorted[1].name} ${sorted[1].value.toFixed(3)}; ${window.count} posts` : 'no matched posts') + (window.partial ? '; partial archive day' : '');
      const legacy = document.querySelector(`.timeline-node[data-event-index="${index}"]`);
      legacy.title = description;
      legacy.setAttribute('aria-label',description);
      const svg = document.querySelector(`.timeline-svg-event[data-event-index="${index}"]`);
      if (svg) {
        svg.setAttribute('aria-label',description);
        const title=svg.querySelector('title');
        if(title && title.textContent!==description) title.textContent=description;
      }
      rules.push(`.timeline-node[data-event-index="${index}"] .timeline-dot{background:${background}!important}.svg-timeline .timeline-svg-event[data-event-index="${index}"] .timeline-svg-dot{fill:${fill}!important}`);
    });
    style.textContent=rules.join('\n');
    const tieLegend = document.getElementById('timelineTieLegend');
    const tieExplanation = document.getElementById('timelineTieExplanation');
    if(tieLegend) tieLegend.hidden = !hasTies;
    if(tieExplanation) tieExplanation.hidden = !hasTies;
    document.getElementById('colorWindowNote').textContent=`${names[control.value]} category scores; colors are not intervention probabilities.`;
  }
  control.addEventListener('change',updateColors);
  // SVG markers are rebuilt by the retained layout controller on resize.
  const host=document.querySelector('.svg-timeline-host');
  if(host) new MutationObserver(updateColors).observe(host,{childList:true,subtree:true});
  updateColors();
  document.querySelectorAll('.mobile-window-tabs').forEach(tabs => {
    const sync=()=>{
      tabs.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.classList.contains('is-active'))));
      const active=tabs.querySelector('.is-active');
      const offset={before:'-1',dayof:'0',after:'1'}[active.dataset.window];
      const index=Number(tabs.closest('.event-view').dataset.eventIndex);
      const hint=tabs.parentElement.querySelector('.mobile-swipe-note');
      if(hint) hint.style.display=data.events[index].windows[offset].count>1?'block':'none';
    };
    tabs.addEventListener('click',sync);
    sync();
  });

  const heading = document.getElementById('selected-event-heading');
  const recordsDialog = document.getElementById('event-records-dialog');
  let recordsOpener = null;
  let parentScrollStyle = null;
  function positionRecordsDialog() {
    let top = 12, height = window.innerHeight - 24;
    // The portfolio expands this iframe to its full document height. Position
    // its top-layer dialog inside the visible outer viewport, not that height.
    try {
      if (window.frameElement && window.parent !== window) {
        const frame = window.frameElement.getBoundingClientRect();
        const header = window.parent.document.querySelector('#quarto-header');
        const visibleTop = Math.max(frame.top, 0, header?.getBoundingClientRect().bottom || 0);
        top = visibleTop - frame.top + 12;
        height = Math.min(window.parent.innerHeight, frame.bottom) - visibleTop - 24;
      }
    } catch (_) { /* Standalone or cross-origin embeds use their own viewport. */ }
    recordsDialog.style.top = top + 'px';
    recordsDialog.style.maxHeight = Math.max(120, height) + 'px';
  }
  document.querySelectorAll('.event-details-button').forEach(button => {
    button.addEventListener('click', () => {
      recordsOpener = button;
      const view = button.closest('.event-view');
      const template = document.getElementById(button.dataset.eventTemplate);
      const date = new Date(view.dataset.eventDate + 'T12:00:00Z').toLocaleDateString('en-US', {
        timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric'
      });
      document.getElementById('event-records-title').textContent = date + ' · ' + button.closest('.event-card').querySelector('.event-card-title').textContent;
      document.getElementById('event-records-content').replaceChildren(template.content.cloneNode(true));
      positionRecordsDialog();
      try {
        if (window.parent !== window) {
          parentScrollStyle = window.parent.document.documentElement.style.overflow;
          window.parent.document.documentElement.style.overflow = 'hidden';
        }
      } catch (_) { /* No parent scroll lock is needed in standalone mode. */ }
      recordsDialog.showModal();
    });
  });
  recordsDialog.querySelector('.event-dialog-close').addEventListener('click', () => recordsDialog.close());
  recordsDialog.addEventListener('click', event => {
    if (event.target !== recordsDialog) return;
    const bounds = recordsDialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) recordsDialog.close();
  });
  recordsDialog.addEventListener('close', () => {
    if (parentScrollStyle !== null) {
      window.parent.document.documentElement.style.overflow = parentScrollStyle;
      parentScrollStyle = null;
    }
    if (recordsOpener?.isConnected) recordsOpener.focus({preventScroll:true});
  });
  window.addEventListener('resize', () => { if (recordsDialog.open) positionRecordsDialog(); });
  try {
    if (window.parent !== window) window.parent.addEventListener('resize', () => { if (recordsDialog.open) positionRecordsDialog(); });
  } catch (_) { /* Cross-origin parent cannot be observed. */ }
  function syncSelection() {
    const active = document.querySelector('.event-view.is-active');
    if (!active) return;
    const index = Number(active.dataset.eventIndex);
    const event = data.events[index];
    heading.textContent = new Date(event.date + 'T12:00:00Z').toLocaleDateString('en-US', {
      timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric'
    }) + ' · Event details and posts';
    document.querySelectorAll('.timeline-svg-event, .timeline-node, .severity-point').forEach(mark => {
      mark.setAttribute('aria-pressed', String(Number(mark.dataset.eventIndex) === index));
    });
  }
  document.querySelectorAll('.event-view').forEach(view => {
    new MutationObserver(syncSelection).observe(view, {attributes:true, attributeFilter:['class']});
  });
  if (host) new MutationObserver(syncSelection).observe(host, {childList:true});

  const severityWindow = document.getElementById('severityWindow');
  const excludeLargest = document.getElementById('severityExcludeLargest');
  const charts = document.getElementById('severity-charts');
  const tooltip = document.getElementById('severity-tooltip');
  const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  function rank(values) {
    return values.map(value => 1 + values.filter(x => x < value).length + (values.filter(x => x === value).length - 1)/2);
  }
  function correlation(rows, frame) {
    const x=rank(rows.map(r=>r.fatalities)), y=rank(rows.map(r=>r.means[frame]));
    const mx=x.reduce((a,b)=>a+b,0)/x.length, my=y.reduce((a,b)=>a+b,0)/y.length;
    const dx=x.map(v=>v-mx), dy=y.map(v=>v-my);
    const denominator=Math.sqrt(dx.reduce((s,v)=>s+v*v,0)*dy.reduce((s,v)=>s+v*v,0));
    return denominator ? dx.reduce((s,v,i)=>s+v*dy[i],0)/denominator : null;
  }
  function renderSeverity() {
    const offset=severityWindow.value;
    const rows=data.severity[offset].rows.filter(r=>!excludeLargest.checked || r.date!=='2026-02-28');
    const frames=data.frames.slice(0,4);
    // Keep a fixed log scale across panels and sensitivity states.
    const x = value => 48 + Math.log10(value)/Math.log10(200)*262;
    const y = value => 207 - value*166;
    tooltip.hidden=true;
    document.getElementById('severity-summary').textContent=`${names[offset]} · ${rows.length} dates with complete matched-post windows. Select or focus a point for its values; click or press Enter to open its event details.`;
    charts.innerHTML=frames.map((frame,i)=>{
      let marks=[0,.5,1].map(t=>`<line x1="48" x2="310" y1="${y(t)}" y2="${y(t)}" class="chart-grid"/><text x="37" y="${y(t)+4}" text-anchor="end">${t}</text>`).join('');
      marks += [1,5,25,100,200].map(t=>`<line x1="${x(t)}" x2="${x(t)}" y1="207" y2="212" class="chart-axis"/><text x="${x(t)}" y="229" text-anchor="middle">${t}</text>`).join('');
      marks += '<text x="179" y="255" text-anchor="middle">Same-day deaths · log scale</text><text x="48" y="24">Mean model score</text>';
      rows.forEach(r=>{
        marks += `<line x1="${x(Math.max(1,r.low))}" x2="${x(Math.max(1,r.high))}" y1="${y(r.means[frame])}" y2="${y(r.means[frame])}" stroke="${colors[i]}" stroke-width="2" opacity=".6"/><circle class="severity-point" data-event-index="${r.index}" data-frame="${escape(frame)}" cx="${x(r.fatalities)}" cy="${y(r.means[frame])}" r="6" fill="${colors[i]}" tabindex="0" role="button" aria-label="${escape(`${r.date}: ${r.fatalities} deaths (low–high ${r.low}–${r.high}), ${frame} ${r.means[frame].toFixed(3)}, ${r.count} posts. Open event details.`)}"/>`;
      });
      const rho=correlation(rows,frame);
      return `<figure class="severity-small"><figcaption>${escape(frame)} <span>ρ = ${rho===null?'unavailable':rho.toFixed(2)} · n = ${rows.length}</span></figcaption><svg viewBox="0 0 350 274" aria-label="${escape(frame)} by same-day fatalities">${marks}</svg></figure>`;
    }).join('');
    document.getElementById('severity-values').innerHTML='<caption>Displayed dates only; scores are means within the selected post window.</caption><thead><tr><th scope="col">Date</th><th scope="col">Deaths (low–high)</th><th scope="col">Posts</th>'+frames.map(f=>`<th scope="col">${escape(f)}</th>`).join('')+'</tr></thead><tbody>'+rows.map(r=>`<tr><th scope="row">${r.date}</th><td>${r.fatalities} (${r.low}–${r.high})</td><td>${r.count}</td>${frames.map(f=>`<td>${r.means[f].toFixed(3)}</td>`).join('')}</tr>`).join('')+'</tbody>';
    charts.querySelectorAll('.severity-point').forEach(point=>{
      const r=rows.find(row=>row.index===Number(point.dataset.eventIndex));
      const show=()=>{
        tooltip.textContent=`${r.date} · ${r.fatalities} deaths (low–high ${r.low}–${r.high}) · ${point.dataset.frame}: ${r.means[point.dataset.frame].toFixed(3)} · ${r.count} posts`;
        tooltip.hidden=false;
        const box=point.getBoundingClientRect();
        tooltip.style.left=Math.max(8,Math.min(box.left,window.innerWidth-288))+'px';
        tooltip.style.top=Math.max(8,Math.min(box.bottom+8,window.innerHeight-100))+'px';
      };
      const open=()=>{
        document.querySelector(`.timeline-node[data-event-index="${r.index}"]`).click();
        tooltip.hidden=true;
        heading.scrollIntoView({block:'start'});
        heading.focus({preventScroll:true});
      };
      point.addEventListener('mouseenter',show);
      point.addEventListener('focus',show);
      point.addEventListener('mouseleave',()=>{tooltip.hidden=true;});
      point.addEventListener('blur',()=>{tooltip.hidden=true;});
      point.addEventListener('click',open);
      point.addEventListener('keydown',event=>{
        if(event.key==='Enter'||event.key===' ') {event.preventDefault();open();}
        if(event.key==='Escape') tooltip.hidden=true;
      });
    });
    syncSelection();
  }
  severityWindow.addEventListener('change',renderSeverity);
  excludeLargest.addEventListener('change',renderSeverity);
  renderSeverity();
  syncSelection();
})();
