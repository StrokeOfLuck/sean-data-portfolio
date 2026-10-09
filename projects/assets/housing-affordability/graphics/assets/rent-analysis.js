/* Shared arithmetic for the article, references, map audit and build validation. */
(function(root) {
  'use strict';
  const valid = r => r.eligible_price && Number.isFinite(r.rent_low) && Number.isFinite(r.rent_high) && r.rent_low > 0 && r.rent_high >= r.rent_low;
  const median = v => { const a = [...v].sort((x,y)=>x-y), n=a.length; return n ? (a[Math.floor((n-1)/2)]+a[Math.floor(n/2)])/2 : null; };
  function stats(rows) {
    const a=rows.filter(valid), n=a.length;
    const low_sum=a.reduce((s,r)=>s+r.rent_low,0), high_sum=a.reduce((s,r)=>s+r.rent_high,0);
    const avg_low=n?low_sum/n:null, avg_high=n?high_sum/n:null;
    return {count:rows.length,n,low_n:n,high_n:n,low_sum,high_sum,avg_low,avg_high,midpoint:n?(avg_low+avg_high)/2:null,median_midpoint:median(a.map(r=>(r.rent_low+r.rent_high)/2))};
  }
  function summarize(rows) {
    return {uniqueCount:rows.length, excluded:rows.filter(r=>!valid(r)).length,
      perOverall:stats(rows.filter(r=>r.pricing_type==='Per bedroom')),
      wholeOverall:stats(rows.filter(r=>r.pricing_type==='Whole unit'))};
  }
  function union(rows) { return [...new Map(rows.filter(r=>r.in_union).map(r=>[r.site_id,r])).values()]; }
  function campus(rows,key,inner=0,outer=5) {return rows.filter(r=>r['distance_'+key]<=outer && (inner===0?r['distance_'+key]>=0:r['distance_'+key]>inner));}
  function resources({wage,hours,weeks=52,months=12,grant=0,loan=0,other=0}) {
    const pay=wage*hours*weeks/months;
    return {pay,grant:grant/months,loan:loan/months,other:other/months,total:pay+(grant+loan+other)/months};
  }
  // CDS 2025–26, Section H: 2024–25 final recipient averages, not a typical joint package.
  const aidBenchmarks=Object.freeze({grant:14743,loan:4106,months:12,weeks:52,year:'2024–25'});
  function aidPreset({includeGrant=false,includeLoan=false}={}) {
    return {months:aidBenchmarks.months,weeks:aidBenchmarks.weeks,
      grant:includeGrant?aidBenchmarks.grant:0,loan:includeLoan?aidBenchmarks.loan:0,other:0};
  }
  const api={valid,stats,summarize,union,campus,resources,aidBenchmarks,aidPreset};
  if(typeof module!=='undefined' && module.exports) module.exports=api;
  else root.RentAnalysis=api;
})(typeof window==='undefined'?globalThis:window);

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const label = [...document.querySelectorAll('.winter-map-legend span')]
      .find(el => el.textContent.trim() === 'Rent per bedroom listing');
    if (label) label.textContent = 'Rent ($) per bedroom';

    const aidNote = document.getElementById('preset-assumption');
    const burdenClarifier = 'With aid selected, this is a share-of-resources example using HUD’s 30% benchmark, not a formal housing-cost-burden measure.';
    if (aidNote && !aidNote.textContent.includes(burdenClarifier)) {
      const link = aidNote.querySelector('a');
      const note = document.createTextNode(` ${burdenClarifier} `);
      if (link) aidNote.insertBefore(note, link);
      else aidNote.appendChild(note);
    }
  });
}
