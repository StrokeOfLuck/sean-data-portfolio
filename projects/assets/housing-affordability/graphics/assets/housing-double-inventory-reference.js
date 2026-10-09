(function(){
  const housingCard=document.getElementById('ncsu-housing-rates-2026-27');
  if(!housingCard || housingCard.querySelector('.housing-double-inventory-evidence')) return;
  const body=housingCard.querySelector('.ref-body');
  if(!body) return;
  const source='https://leadership.ncsu.edu/wp-content/uploads/sites/2/2025/11/Meeting-Book-November-2025-University-Affairs-Committee-Meeting.pdf#page=81';
  body.insertAdjacentHTML('beforeend', `
    <hr class="rule">
    <h2>Double-occupancy inventory — worked math</h2>
    <div class="housing-double-inventory-evidence">
      <div class="facts">
        <div class="fact"><div class="fact-label">Double Residence Halls</div><div class="fact-value"><strong>7,110 beds</strong></div></div>
        <div class="fact"><div class="fact-label">Total University Housing inventory</div><div class="fact-value"><strong>10,121 beds</strong></div></div>
        <div class="fact"><div class="fact-label">Conservative double share</div><div class="fact-value"><strong>7,110 ÷ 10,121 = 70.25%</strong></div></div>
        <div class="fact"><div class="fact-label">Including E.S. King doubles</div><div class="fact-value"><strong>(7,110 + 128) ÷ 10,121 = 71.51%</strong></div></div>
      </div>
      <div class="use-note"><strong>Reporting note:</strong> NC State's published housing-rate table labels 7,110 beds as “Double Residence Halls” and lists 10,121 total beds. Dividing 7,110 by 10,121 yields 70.25%, so the statement that more than 70% of University Housing's inventory consists of doubles is supported even without counting the additional 128 beds labeled “Double - E.S. King Village (1 BR Apt).” If those 128 beds are included, the share is 71.51%.</div>
      <div class="evidence">
        <a href="${source}" target="_blank" rel="noopener noreferrer"><img src="assets/ncsu-housing-rates-2026-27.webp" alt="NC State University Housing Rental Rates table for academic year 2026-27 showing 7,110 Double Residence Hall beds, 128 Double E.S. King Village beds and 10,121 total beds"></a>
        <div class="caption">NC State University Housing Rental Rates, Academic Year 2026-27. November 2025 University Affairs Committee meeting book, PDF page 81. Click the image to open the official NC State source at that page.</div>
      </div>
      <p><a href="${source}" target="_blank" rel="noopener noreferrer">Open the official NC State source — PDF page 81</a></p>
    </div>
  `);
})();
