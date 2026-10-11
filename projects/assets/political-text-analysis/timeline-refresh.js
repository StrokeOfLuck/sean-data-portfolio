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
    data.events.forEach((event,index) => {
      const window = event.windows[control.value];
      const sorted = window.means ? data.frames.map((name,i) => ({name,i,value:window.means[name]})).sort((a,b)=>b.value-a.value) : [];
      const leaders = sorted.filter(x => Math.abs(x.value-sorted[0].value)<1e-12);
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
})();
