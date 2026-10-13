/* Color is derived from reviewed scores for the selected window. */
(() => {
  'use strict';
  const data = JSON.parse(document.getElementById('timeline-reviewed-data').textContent);
  const control = document.getElementById('colorWindow');
  const colors = ['#9a4949','#4e7657','#4b719c','#7d6594','#b5752e','#2f8f95'];
  const names = {'-1':'Day before','0':'Event day','1':'Day after'};
  const style = document.createElement('style');
  document.head.appendChild(style);
  // Outer circles browse events; inner circles identify the selected event's post windows.
  const mini = document.createElement('nav');
  mini.className = 'mini-event-nav';
  mini.setAttribute('aria-label', 'Event navigation and before and after post windows');
  const miniTrack = document.createElement('div');
  miniTrack.className = 'mini-event-track';
  mini.append(miniTrack);
  const miniButtons = data.events.map((event,index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mini-event-button';
    button.dataset.eventIndex = index;
    const dot = document.createElement('span');
    dot.className = 'mini-event-dot';
    dot.setAttribute('aria-hidden','true');
    const label = document.createElement('span');
    label.className = 'mini-event-label';
    label.textContent = new Date(event.date + 'T12:00:00Z').toLocaleDateString('en-US',{timeZone:'UTC',month:'short',day:'numeric'});
    label.setAttribute('aria-hidden','true');
    const direction = document.createElement('span');
    direction.className = 'mini-event-direction';
    direction.setAttribute('aria-hidden','true');
    button.append(dot,label,direction);
    button.addEventListener('click', () => {
      const top = mini.getBoundingClientRect().top;
      document.querySelector(`.timeline-node[data-event-index="${index}"]`).click();
      syncSelection();
      // Keep this navigation point steady when the new post card has a different height.
      requestAnimationFrame(() => {
        window.scrollBy({top:mini.getBoundingClientRect().top-top,behavior:'instant'});
        button.focus({preventScroll:true});
      });
    });
    button.addEventListener('keydown', event => {
      const next = {ArrowRight:Math.min(index+1,data.events.length-1),ArrowLeft:Math.max(index-1,0),Home:0,End:data.events.length-1}[event.key];
      if (next !== undefined) { event.preventDefault(); miniButtons[next].click(); }
    });
    miniTrack.appendChild(button);
    return button;
  });
  const edgeMarkers = ['No previous event','No next event'].map((text,i) => {
    const marker = document.createElement('div');
    marker.className = 'mini-event-edge';
    marker.dataset.position = i === 0 ? 'previous' : 'next';
    marker.innerHTML = '<span class="mini-event-dot" aria-hidden="true"></span><span class="mini-event-label"></span>';
    marker.querySelector('.mini-event-label').textContent = text;
    miniTrack.appendChild(marker);
    return marker;
  });
  const windowMarkers = ['before','after'].map((side,i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mini-window-marker ' + side;
    button.dataset.window = i === 0 ? '-1' : '1';
    button.innerHTML = '<span class="mini-event-dot" aria-hidden="true"></span><span class="mini-event-label"></span><span class="mini-event-direction">'+(i === 0 ? 'Day before posts' : 'Day after posts')+'</span>';
    button.addEventListener('click', () => {
      const active = document.querySelector('.event-view.is-active');
      if (window.matchMedia('(max-width:900px)').matches) active.querySelector(`.mobile-window-tab[data-window="${side}"]`)?.click();
      const branch = active.querySelector(`.${side}-branch`);
      branch.setAttribute('tabindex','-1');
      branch.scrollIntoView({block:'start'});
      branch.focus({preventScroll:true});
    });
    miniTrack.appendChild(button);
    return button;
  });
  function updateWindowMarkers() {
    const index = Number(document.querySelector('.event-view.is-active')?.dataset.eventIndex || 0);
    const event = data.events[index];
    windowMarkers.forEach(marker => {
      const offset = marker.dataset.window;
      const window = event.windows[offset];
      const ranked = window.means ? data.frames.map((frame,i)=>({i,frame,value:window.means[frame]})).sort((a,b)=>b.value-a.value) : [];
      const leaders = ranked.filter(item=>Math.abs(item.value-ranked[0].value)<1e-12);
      const background = leaders.length > 1 ? `conic-gradient(${leaders.map((item,i)=>`${colors[item.i]} ${i*100/leaders.length}% ${(i+1)*100/leaders.length}%`).join(',')})` : leaders.length ? colors[leaders[0].i] : '#89919a';
      marker.querySelector('.mini-event-dot').style.background = background;
      const date = new Date(event.date+'T12:00:00Z');
      date.setUTCDate(date.getUTCDate()+Number(offset));
      const label = date.toLocaleDateString('en-US',{timeZone:'UTC',month:'short',day:'numeric'});
      marker.querySelector('.mini-event-label').textContent = label;
      const description = `${names[offset]} · ${label}: ${ranked.length ? ranked[0].frame+' '+ranked[0].value.toFixed(3) : 'no matched posts'}; ${window.count} posts. View posts.`;
      marker.title = description;
      marker.setAttribute('aria-label',description);
    });
  }
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
      miniButtons[index].title = description;
      miniButtons[index].setAttribute('aria-label',description);
      const svg = document.querySelector(`.timeline-svg-event[data-event-index="${index}"]`);
      if (svg) {
        svg.setAttribute('aria-label',description);
        const title=svg.querySelector('title');
        if(title && title.textContent!==description) title.textContent=description;
      }
      rules.push(`.timeline-node[data-event-index="${index}"] .timeline-dot,.mini-event-button[data-event-index="${index}"] .mini-event-dot{background:${background}!important}.svg-timeline .timeline-svg-event[data-event-index="${index}"] .timeline-svg-dot{fill:${fill}!important}`);
    });
    style.textContent=rules.join('\n');
    const tieLegend = document.getElementById('timelineTieLegend');
    const tieExplanation = document.getElementById('timelineTieExplanation');
    if(tieLegend) tieLegend.hidden = !hasTies;
    if(tieExplanation) tieExplanation.hidden = !hasTies;
    document.getElementById('colorWindowNote').textContent=`${names[control.value]} category scores; colors are not intervention probabilities.`;
    updateWindowMarkers();
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
  const recordsHost = document.getElementById('event-record-controls');
  const recordControls = [];
  let activeRecords = null;
  document.querySelectorAll('.event-details-wrap').forEach(wrap => {
    const card = wrap.closest('.event-card');
    const index = Number(wrap.closest('.event-view').dataset.eventIndex);
    const button = wrap.querySelector('.event-details-button');
    const panel = wrap.querySelector('.event-popover');
    button.innerHTML = card.querySelector('.event-card-title').textContent + ' <span aria-hidden="true">⌄</span>';
    panel.querySelector('.event-popover-header strong').textContent = data.events[index].date + ' · ' + card.querySelector('.event-card-title').textContent;
    const timing = document.createElement('p');
    timing.className = 'event-card-note';
    timing.textContent = card.querySelector('.event-card-timing').textContent;
    panel.querySelector('.event-popover-body').prepend(timing);
    wrap.appendChild(card.querySelector('.sig-pill'));
    wrap.hidden = true;
    recordControls[index] = wrap;
    recordsHost.appendChild(wrap);
    let pinned = false, openTimer, closeTimer, suppressFocusOpen = false;
    const close = (restoreFocus = false) => {
      clearTimeout(openTimer);
      clearTimeout(closeTimer);
      pinned = false;
      panel.hidden = true;
      button.setAttribute('aria-expanded', 'false');
      wrap.classList.remove('records-open');
      if (activeRecords?.wrap === wrap) activeRecords = null;
      if (restoreFocus) {
        suppressFocusOpen = true;
        button.focus({preventScroll:true});
        queueMicrotask(() => { suppressFocusOpen = false; });
      }
    };
    const open = () => {
      clearTimeout(closeTimer);
      if (activeRecords?.wrap !== wrap) activeRecords?.close();
      panel.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      wrap.classList.add('records-open');
      activeRecords = {wrap, close, index};
    };
    const scheduleClose = () => {
      clearTimeout(openTimer);
      clearTimeout(closeTimer);
      closeTimer = setTimeout(() => {
        if (!pinned && !wrap.contains(document.activeElement)) close();
      }, 250);
    };
    wrap.addEventListener('pointerenter', event => {
      clearTimeout(closeTimer);
      if (event.pointerType === 'mouse') openTimer = setTimeout(open, 150);
    });
    wrap.addEventListener('pointerleave', scheduleClose);
    panel.addEventListener('pointerenter', () => clearTimeout(closeTimer));
    wrap.addEventListener('focusin', () => { if (!suppressFocusOpen) open(); });
    wrap.addEventListener('focusout', event => { if (!wrap.contains(event.relatedTarget)) scheduleClose(); });
    button.addEventListener('click', () => {
      if (pinned) close();
      else { pinned = true; open(); }
    });
    panel.querySelector('.event-popover-close').addEventListener('click', () => close(true));
    wrap.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); close(true); }
    });
  });
  document.addEventListener('pointerdown', event => {
    if (activeRecords && !activeRecords.wrap.contains(event.target)) activeRecords.close();
  });
  function syncSelection() {
    const active = document.querySelector('.event-view.is-active');
    if (!active) return;
    const index = Number(active.dataset.eventIndex);
    if (activeRecords && activeRecords.index !== index) activeRecords.close();
    recordControls.forEach((wrap,i) => { wrap.hidden = i !== index; });
    const event = data.events[index];
    heading.textContent = new Date(event.date + 'T12:00:00Z').toLocaleDateString('en-US', {
      timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric'
    });
    const rail = active.querySelector('.rail-wrap');
    if (mini.parentElement !== rail) rail.appendChild(mini);
    for (const [side,offset,label] of [['before',-1,'Day before'],['after',1,'Day after']]) {
      const date = new Date(event.date+'T12:00:00Z');
      date.setUTCDate(date.getUTCDate()+offset);
      const dateLabel = date.toLocaleDateString('en-US',{timeZone:'UTC',month:'short',day:'numeric'});
      active.querySelector(`.${side}-branch .branch-heading strong`).textContent = `${label} · ${dateLabel}`;
    }
    miniButtons.forEach((button,i) => {
      const offset = i-index;
      button.hidden = Math.abs(offset) > 1;
      button.dataset.position = offset === -1 ? 'previous' : offset === 1 ? 'next' : 'current';
      button.setAttribute('aria-current', i === index ? 'date' : 'false');
      button.tabIndex = i === index ? 0 : -1;
      button.querySelector('.mini-event-label').textContent = i === index ? heading.textContent : new Date(data.events[i].date+'T12:00:00Z').toLocaleDateString('en-US',{timeZone:'UTC',month:'short',day:'numeric'});
      button.querySelector('.mini-event-direction').textContent = offset === -1 ? '← Previous event' : offset === 1 ? 'Next event →' : 'Selected event';
    });
    edgeMarkers[0].hidden = index !== 0;
    edgeMarkers[1].hidden = index !== data.events.length-1;
    updateWindowMarkers();
    const selected = miniButtons[index];
    if (mini.scrollWidth > mini.clientWidth) {
      const center = selected.getBoundingClientRect().left+selected.offsetWidth/2-mini.getBoundingClientRect().left+mini.scrollLeft;
      mini.scrollLeft = center-mini.clientWidth/2;
    }
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
