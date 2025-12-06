/**
 * ISA-88 Page - Tag-based rendering
 */
(async function() {
  const T = TagLoader;
  const tags = await T.loadTags(['app', 'nav-items', 'labels-isa88']);
  const d = T.getLabels(tags, 'isa88');

  document.getElementById('app').innerHTML = `
    ${T.buildNav(tags, 'standards').replace('class="active"', '')}
    <div class="container">
      <div class="page-header"><h1 class="page-title">${d.title}</h1><p class="page-subtitle">${d.subtitle}</p></div>
      <div class="grid grid-2">
        <div class="card"><h3>${d.physModel}</h3><div class="model-diagram">
          ${d.levels.map((l, i) => `<div class="model-level" style="background:linear-gradient(90deg,hsl(${210 + i * 15},50%,${25 + i * 5}%),hsl(${210 + i * 15},50%,${35 + i * 5}%));margin-left:${i * 10}px;">${l}</div>`).join('')}
        </div></div>
        <div class="card"><h3>${d.procModel}</h3><div class="model-diagram">
          ${d.procLevels.map((l, i) => `<div class="model-level" style="background:linear-gradient(90deg,hsl(${150 + i * 20},50%,${25 + i * 5}%),hsl(${150 + i * 20},50%,${35 + i * 5}%));margin-left:${i * 20}px;">${l}</div>`).join('')}
        </div></div>
      </div>
      <div class="grid grid-3 mt-2">
        <div class="card"><h4>${d.cmTitle}</h4><p style="color:var(--text-secondary);">${d.cmDesc}</p></div>
        <div class="card"><h4>${d.emTitle}</h4><p style="color:var(--text-secondary);">${d.emDesc}</p></div>
        <div class="card"><h4>${d.unitTitle}</h4><p style="color:var(--text-secondary);">${d.unitDesc}</p></div>
      </div>
    </div>
    <style>.model-diagram{display:flex;flex-direction:column;gap:0.5rem;}.model-level{padding:0.75rem 1rem;border-radius:var(--radius);text-align:center;}</style>`;
})();
