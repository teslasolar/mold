/**
 * ISA-95 Page - Tag-based rendering
 */
(async function() {
  const T = TagLoader;
  const tags = await T.loadTags(['app', 'nav-items', 'labels-isa95']);
  const d = T.getLabels(tags, 'isa95');
  const colors = ['#1a365d', '#2a4365', '#2f5a3f', '#3f6212', '#854d0e'];

  document.getElementById('app').innerHTML = `
    ${T.buildNav(tags, 'standards').replace('class="active"', '')}
    <div class="container">
      <div class="page-header"><h1 class="page-title">${d.title}</h1><p class="page-subtitle">${d.subtitle}</p></div>
      <div class="grid grid-2">
        <div class="card"><h3>${d.purdue}</h3><div class="purdue-model">
          ${d.levels.map((l, i) => `<div class="purdue-level" style="background:linear-gradient(90deg,${colors[i]},${colors[i]}dd);">
            <div><strong>${l.n}</strong><div style="font-size:0.875rem;color:var(--text-secondary);">${l.d}</div></div>
            <div style="font-size:0.75rem;color:var(--text-muted);">${l.s}</div>
          </div>`).join('')}
        </div></div>
        <div class="card"><h3>${d.domains}</h3>
          ${d.domainList.map(dom => `<div style="padding:0.75rem 1rem;background:var(--bg-hover);border-radius:var(--radius);margin-bottom:0.5rem;">📊 ${dom}</div>`).join('')}
        </div>
      </div>
    </div>
    <style>.purdue-model{display:flex;flex-direction:column;gap:0.25rem;}.purdue-level{padding:1rem;border-radius:var(--radius);display:flex;justify-content:space-between;align-items:center;}</style>`;
})();
