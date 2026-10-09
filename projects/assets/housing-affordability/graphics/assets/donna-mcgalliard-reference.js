(function(){
  const housingCard=document.getElementById('ncsu-housing-rates-2026-27');
  if(!housingCard || housingCard.querySelector('.donna-mcgalliard-evidence')) return;
  const body=housingCard.querySelector('.ref-body');
  if(!body) return;
  body.insertAdjacentHTML('beforeend', `
    <hr class="rule">
    <h2>Donna McGalliard — title verification</h2>
    <div class="donna-mcgalliard-evidence">
      <div class="facts">
        <div class="fact"><div class="fact-label">Student Life and Advocacy title</div><div class="fact-value"><strong>Associate Vice Chancellor and Associate Dean, Student Life and Advocacy</strong></div></div>
        <div class="fact"><div class="fact-label">University Housing role</div><div class="fact-value"><strong>Executive Director of University Housing</strong></div></div>
      </div>
      <div class="use-note"><strong>Reporting note:</strong> NC State's University Housing staff profile lists McGalliard as associate vice chancellor and associate dean for Student Life and Advocacy and places her in the Executive Director group. A March 23, 2026 DASA News profile states both roles together, identifying her as an associate vice chancellor and associate dean in DASA and the executive director of University Housing.</div>
      <p><a href="https://housing.dasa.ncsu.edu/staff/dpmcgall/" target="_blank" rel="noopener noreferrer">NC State University Housing — Donna McGalliard staff profile</a> · <a href="https://news.dasa.ncsu.edu/mcgalliard-named-seaho-outstanding-senior-housing-officer-of-the-year/" target="_blank" rel="noopener noreferrer">NC State DASA News — McGalliard profile (March 23, 2026)</a></p>
    </div>
  `);
})();
