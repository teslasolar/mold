/**
 * Standards Index Page - Tag-based rendering
 */
(async function() {
  const T = TagLoader;
  const tags = await T.loadTags(['app', 'nav-items', 'labels-standards']);
  const std = T.getLabels(tags, 'standards');

  document.getElementById('app').innerHTML = `
    ${T.buildNav(tags, 'standards').replace('class="active"', '')}
    <div class="container">
      <div class="page-header"><h1 class="page-title">${std.isa.t}</h1><p class="page-subtitle">${std.isa.s}</p></div>
      <div class="grid grid-3">
        <a href="88/" class="card" style="text-decoration:none;"><div class="report-icon">🏭</div><div class="report-title">${std.s88.t}</div><div class="report-desc">${std.s88.s}</div></a>
        <a href="95/" class="card" style="text-decoration:none;"><div class="report-icon">🔗</div><div class="report-title">${std.s95.t}</div><div class="report-desc">${std.s95.s}</div></a>
        <a href="101/" class="card" style="text-decoration:none;"><div class="report-icon">🖥️</div><div class="report-title">${std.s101.t}</div><div class="report-desc">${std.s101.s}</div></a>
      </div>
    </div>
    <style>.report-icon{font-size:2.5rem;margin-bottom:1rem;}.report-title{font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;}.report-desc{font-size:0.875rem;color:var(--text-secondary);}</style>`;
})();
