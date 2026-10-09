(function(){
 const d=RENT_DATA,A=RentAnalysis,el=id=>document.getElementById(id);
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=x=>x==null?'Missing':x.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
 let map=null,shown=[],loaded=false;
 function data(){return {type:'FeatureCollection',features:shown.map(r=>({type:'Feature',geometry:{type:'Point',coordinates:[r.lon,r.lat]},properties:{id:r.site_id,number:String(r.number),name:r.name,url:r.listing_url,status:r.review_status,color:!r.eligible_price?'#777':r.pricing_type==='Per bedroom'?'#2b5f97':'#b86626'}}))};}
 function refresh(){
  const key=el('campus').value,band=el('band').value,category=el('category').value,inc=el('inclusion').value,q=el('search').value.toLowerCase().trim();
  shown=[...d.rentals].sort((a,b)=>a['distance_'+key]-b['distance_'+key]||a.site_id.localeCompare(b.site_id)).map((r,i)=>({...r,number:i+1})).filter(r=>
   (band==='all'||(band==='within'?r['distance_'+key]<=5:r['band_'+key]===band))&&(category==='all'||r.pricing_type===category)&&(inc==='all'||r.eligible_price===(inc==='yes'))&&(!q||[r.name,r.address,r.site_id,r.review_note,...r.flags].join(' ').toLowerCase().includes(q)));
  const v=A.summarize(shown);
  el('audit-count').textContent=`${shown.length} displayed listings · ${v.perOverall.n} usable room/per-bedroom prices · ${v.wholeOverall.n} usable whole-unit prices · ${v.excluded} excluded prices. Filters apply to both the table and map.`;
  el('listing-rows').innerHTML=shown.map(r=>`<tr><td>${r.number}<small>${esc(r.site_id)}</small></td><td><a href="${esc(r.listing_url)}" target="_blank" rel="noopener">${esc(r.name)}</a><small>${esc(r.address)}, ${esc(r.city)}</small></td><td>${esc(r.pricing_type==='Per bedroom'?'Room / per bedroom':r.pricing_type)}<small>Originally: ${esc(r.original_pricing_type)}</small></td><td>${money(r.rent_low)}${r.rent_high!==r.rent_low?'–'+money(r.rent_high):''}</td><td>${r['distance_'+key].toFixed(6)} mi<small>${esc(r['band_'+key])}${r['boundary_feet_'+key]<=100?' · within '+r['boundary_feet_'+key].toFixed(2)+' ft of band edge':''}</small></td><td>${esc(r.review_status)}</td><td>${esc(r.review_note)}<small>${esc(r.flags.join('; '))}</small><small>Lease: ${esc(r.lease_term||'not supplied')}; earliest saved move-in date: ${esc(r.earliest_date||'not supplied')}. Dates do not prove vacancy.</small></td></tr>`).join('');
  el('empty').hidden=!!shown.length;if(loaded)map.getSource('listings').setData(data());
 }
 for(const id of ['band','category','inclusion','search'])el(id).addEventListener('input',refresh);
 el('campus').addEventListener('change',()=>{refresh();const c=d.campuses[el('campus').value];if(map)map.flyTo({center:[c.lon,c.lat],zoom:12,duration:500});if(loaded)map.getSource('campus').setData({type:'Point',coordinates:[c.lon,c.lat]});});
 refresh();
 if(typeof maplibregl==='undefined'){el('map-status').textContent='Map library unavailable. The complete table, filters and downloads still work.';return;}
 try {
  map=new maplibregl.Map({container:'map',style:'https://tiles.openfreemap.org/styles/positron',center:[d.campuses.main.lon,d.campuses.main.lat],zoom:12});
  map.addControl(new maplibregl.NavigationControl());
  map.on('error',()=>{el('map-status').textContent='Some map resources could not load. Use the listing table for the complete audit.';});
  map.on('load',()=>{
   const c=d.campuses[el('campus').value];map.addSource('listings',{type:'geojson',data:data()});map.addLayer({id:'points',type:'circle',source:'listings',paint:{'circle-color':['get','color'],'circle-radius':10,'circle-stroke-color':'#fff','circle-stroke-width':1}});map.addLayer({id:'numbers',type:'symbol',source:'listings',layout:{'text-field':['get','number'],'text-size':10,'text-allow-overlap':true},paint:{'text-color':'#fff'}});
   map.addSource('campus',{type:'geojson',data:{type:'Point',coordinates:[c.lon,c.lat]}});map.addLayer({id:'campus',type:'symbol',source:'campus',layout:{'text-field':'◆','text-size':24},paint:{'text-color':'#2f7d73','text-halo-color':'#fff','text-halo-width':2}});loaded=true;
   map.on('click','points',e=>{const p=e.features[0].properties;new maplibregl.Popup().setLngLat(e.lngLat).setHTML(`<b>${esc(p.number)} · ${esc(p.name)}</b><p>${esc(p.status)}</p><a href="${esc(p.url)}" target="_blank" rel="noopener">Open original listing</a>`).addTo(map);});
  });
 }catch(e){el('map-status').textContent='Map unavailable in this browser. The table and downloads remain usable.';}
})();
