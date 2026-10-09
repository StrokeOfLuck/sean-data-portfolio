(function(){
  const card=document.getElementById('ncsu-2024-food-housing-report');
  if(!card || card.querySelector('.housing-coa-2024-evidence')) return;

  const title=card.querySelector('.ref-title');
  if(title) title.textContent='NC State Food and Housing Insecurity Report — Housing Affordability and Student Pay';

  const tags=card.querySelector('.tags');
  if(tags && ![...tags.querySelectorAll('.tag')].some(el=>el.textContent.trim()==='Housing affordability')){
    tags.insertAdjacentHTML('beforeend','<span class="tag">Housing affordability</span>');
  }

  const facts=card.querySelector('.facts');
  if(facts){
    facts.insertAdjacentHTML('afterbegin', `
      <div class="fact">
        <div class="fact-label">On-campus housing estimate</div>
        <div class="fact-value">For 2023–24, NC State's published estimated housing cost was <strong>$7,996 for two semesters</strong>, approximately <strong>$888 per month</strong>. The report says that amount could cover <strong>only 4 of 14 on-campus residence halls</strong>, excluding the two coastal residence halls, after adding the required $280 internet charge.</div>
      </div>
      <div class="fact">
        <div class="fact-label">Required meal-plan context</div>
        <div class="fact-value">The report also notes that first-year students living on campus were automatically enrolled in a meal plan costing <strong>$5,150 + tax per academic year</strong>.</div>
      </div>
    `);
  }

  const body=card.querySelector('.ref-body');
  if(!body) return;
  body.insertAdjacentHTML('beforeend', `
    <div class="housing-coa-2024-evidence">
      <hr class="rule">
      <h2>Source passage — required on-campus living</h2>
      <div class="use-note">
        <strong>Archived source PDF:</strong>
        <a href="assets/2023-food-and-housing-insecurity.pdf#page=28" target="_blank" rel="noopener noreferrer">Open the saved March 2024 NC State report at the “Required on-campus living” passage</a>.
        The passage states that the 2023–24 published housing estimate was $7,996 for two semesters and that, at that amount, students could afford only 4 of 14 on-campus residence halls after the required internet charge.
      </div>
      <div class="use-note"><strong>Archive note:</strong> This is the exact PDF supplied for the reporting archive. The earlier recreated SVG is no longer used as evidence.</div>
      <div class="use-note"><strong>Reporting note:</strong> These figures describe the 2023–24 academic year and should be treated as historical context. Current 2026–27 cost-of-attendance and University Housing rates are documented separately on this references page.</div>
    </div>
  `);
})();
