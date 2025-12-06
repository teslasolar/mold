/**
 * ISA-101 Page - Tag-based rendering
 */
(async function() {
  const T = TagLoader;
  const tags = await T.loadTags(['app', 'nav-items', 'labels-isa101']);
  const d = T.getLabels(tags, 'isa101');
  const lvlColors = ['#1a365d', '#2a4365', '#3f5a3f', '#4a5568'];

  document.getElementById('app').innerHTML = `
    ${T.buildNav(tags, 'standards').replace('class="active"', '')}
    <div class="container">
      <div class="page-header"><h1 class="page-title">${d.title}</h1><p class="page-subtitle">${d.subtitle}</p></div>
      <div class="grid grid-2">
        <div class="card"><h3>${d.hier}</h3>
          ${d.levels.map((l, i) => `<div class="hmi-level" style="background:linear-gradient(90deg,${lvlColors[i]},${lvlColors[i]}cc);border-left:4px solid ${d.colorList[i]?.c || '#4299e1'};">
            <strong>${l.n}</strong> - ${l.d}<div style="font-size:0.875rem;color:var(--text-secondary);margin-top:0.25rem;">${l.c}</div>
          </div>`).join('')}
        </div>
        <div>
          <div class="card mb-2"><h3>${d.colors}</h3>
            <div style="display:flex;gap:1rem;flex-wrap:wrap;">
              ${d.colorList.map(c => `<div style="display:flex;align-items:center;gap:0.5rem;">
                <div style="width:1.5rem;height:1.5rem;border-radius:4px;background:${c.c};"></div><span>${c.s}</span>
              </div>`).join('')}
            </div>
          </div>
          <div class="card"><h3>${d.principles}</h3>
            ${d.principleList.map(p => `<div style="padding:0.5rem 1rem;background:var(--bg-hover);border-radius:var(--radius);margin-bottom:0.5rem;">✓ ${p}</div>`).join('')}
          </div>
        </div>
      </div>
    </div>
    <style>.hmi-level{padding:1rem;border-radius:var(--radius);margin-bottom:0.5rem;}</style>`;
})();
