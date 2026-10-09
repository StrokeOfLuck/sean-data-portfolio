(function(){
  function addResNetMath(){
    if(document.getElementById('resnet-exclusion-math')) return;
    const section=document.getElementById('cost-of-attendance');
    if(!section) return;
    const body=section.querySelector('.ref-body') || section;
    const paras=[...body.querySelectorAll('p')];
    const anchor=paras.find(p => p.textContent.includes('$915.56/month per student'));
    if(!anchor) return;

    const note=document.createElement('div');
    note.className='use-note';
    note.id='resnet-exclusion-math';
    note.innerHTML='<strong>Room-charge-only view (ResNet excluded for comparison):</strong> Double: $3,970 × 2 semesters = $7,940; $7,940 ÷ 9 months = <strong>$882.22/month per student</strong>. Single: $4,600 × 2 = $9,200; $9,200 ÷ 9 = <strong>$1,022.22/month per student</strong>. This comparison removes the $150-per-semester ResNet charge from the displayed monthly equivalent; residents still pay the required ResNet fee for internet access.';
    anchor.insertAdjacentElement('afterend',note);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',addResNetMath,{once:true});
  }else{
    addResNetMath();
  }
})();
