/**
 * Heatmap Page - Tag-based rendering
 */
(async function() {
  const T = TagLoader, M = MoldKonomi;
  const tags = await T.loadTags([...T.coreTags, 'legend', 'wings', 'floors', 'labels-table']);
  const L = (g, k, f) => T.getLabel(tags, g, k, f);
  const legend = T.getLabels(tags, 'legend'), wings = T.getLabels(tags, 'wings'), floors = T.getLabels(tags, 'floors');
  const cards = T.getLabels(tags, 'cards'), tbl = T.getLabels(tags, 'table');

  const app = document.getElementById('app');
  app.innerHTML = `
    ${T.buildNav(tags, 'heatmap')}
    <div class="container">
      ${T.buildPageHeader(tags, 'heatmap', `<div class="view-toggle">
        <button class="active" onclick="setView('severity')">Severity</button>
        <button onclick="setView('moisture')">Moisture</button>
      </div>`)}
      <div class="legend mb-2">${Object.entries(legend).map(([k, v]) => `<div class="legend-item">
        <div class="legend-color" style="background:var(--severity-${['none','minor','moderate','severe','critical'][k]});${k === '0' ? 'opacity:0.4;' : ''}"></div>
        <span>${v}</span></div>`).join('')}</div>
      <div id="heatmap-container" class="heatmap-large">${T.loading()}</div>
      <div class="card mt-2"><div class="card-header"><span class="card-title">${cards.floorSummary}</span></div>
        <div class="table-container"><table><thead><tr>
          <th>${L('form','floor','Floor')}</th><th>${L('stats','totalUnits','Total')}</th><th>${tbl.affected}</th>
          <th>${L('stats','avgSeverity','Avg')}</th><th>${L('stats','maxSeverity','Max')}</th>
          <th>${L('stats','critical','Critical')}</th><th>${L('stats','severe','Severe')}</th>
        </tr></thead><tbody id="floor-summary-table"><tr><td colspan="7" class="text-center">${T.loading()}</td></tr></tbody></table></div>
      </div>
      <div id="unit-tooltip" style="display:none;position:fixed;background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:0.75rem;z-index:1000;pointer-events:none;box-shadow:var(--shadow);"><div id="tooltip-content"></div></div>
    </div>
    <style>.heatmap-large{display:grid;grid-template-columns:repeat(4,1fr);gap:1.5rem;}.wing-block{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:1rem;}.wing-title{font-weight:600;margin-bottom:1rem;padding-bottom:0.5rem;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;}.floor-row-large{display:flex;gap:4px;margin-bottom:4px;align-items:center;}.floor-label-large{width:2.5rem;font-size:0.875rem;color:var(--text-muted);}.unit-cell-large{width:2rem;height:2rem;border-radius:4px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:0.625rem;font-weight:600;transition:transform 0.1s,box-shadow 0.1s;}.unit-cell-large:hover{transform:scale(1.15);box-shadow:0 0 10px rgba(255,255,255,0.2);z-index:10;}.unit-cell-large[data-severity="0"]{background:var(--severity-none);opacity:0.4;}.unit-cell-large[data-severity="1"]{background:var(--severity-minor);color:#000;}.unit-cell-large[data-severity="2"]{background:var(--severity-moderate);color:#000;}.unit-cell-large[data-severity="3"]{background:var(--severity-severe);color:#fff;}.unit-cell-large[data-severity="4"]{background:var(--severity-critical);color:#fff;}.view-toggle{display:flex;gap:0.5rem;background:var(--bg-hover);padding:4px;border-radius:var(--radius);}.view-toggle button{padding:0.5rem 1rem;border:none;background:transparent;color:var(--text-secondary);cursor:pointer;border-radius:4px;}.view-toggle button.active{background:var(--accent);color:#fff;}</style>`;

  const $ = id => document.getElementById(id);
  let heatmapData = null, currentView = 'severity';

  async function init() { await loadHeatmap(); M.wsSubscribe('updates', loadHeatmap); }

  async function loadHeatmap() {
    try { heatmapData = await M.getHeatmap(); renderHeatmap(); renderFloorSummary(); }
    catch (e) { $('heatmap-container').innerHTML = `<div class="alert alert-critical" style="grid-column:1/-1;">${e.message}</div>`; }
  }

  function renderHeatmap() {
    const { severity_matrix, moisture_matrix, floors: fl, wings: wg } = heatmapData;
    const unitsPerWing = severity_matrix[0]?.[0]?.length || 11;
    const matrix = currentView === 'severity' ? severity_matrix : moisture_matrix;
    let html = '';
    wg.forEach((wn, wi) => {
      html += `<div class="wing-block"><div class="wing-title"><span>${wings[wn] || wn} Wing</span><span style="font-size:0.75rem;color:var(--text-muted);">${unitsPerWing * fl} units</span></div>`;
      for (let f = fl - 1; f >= 0; f--) {
        html += `<div class="floor-row-large"><span class="floor-label-large">${floors[f] || 'F' + f}</span>`;
        for (let u = 0; u < unitsPerWing; u++) {
          let val = currentView === 'severity' ? (severity_matrix[f]?.[wi]?.[u] || 0) : Math.min(4, Math.floor((moisture_matrix[f]?.[wi]?.[u] || 0) * 5));
          const uid = M.makeUnitId(f, wn, u);
          html += `<div class="unit-cell-large" data-severity="${val}" data-unit-id="${uid}" data-floor="${f}" data-wing="${wn}" data-unit="${u}"
            onmouseenter="showTooltip(event,'${uid}')" onmouseleave="hideTooltip()" onclick="goToUnit('${uid}')"></div>`;
        }
        html += '</div>';
      }
      html += '</div>';
    });
    $('heatmap-container').innerHTML = html;
  }

  function renderFloorSummary() {
    const tbody = $('floor-summary-table'), sums = heatmapData.floor_summaries || [];
    tbody.innerHTML = sums.map(f => `<tr><td><strong>${floors[f.floor] || 'F' + f.floor}</strong></td><td>${f.total_units}</td><td>${f.affected_units}</td>
      <td>${f.avg_severity.toFixed(2)}</td><td>${M.severityBadge(f.max_severity)}</td>
      <td style="color:var(--severity-critical);">${f.critical_count}</td><td style="color:var(--severity-severe);">${f.severe_count}</td></tr>`).join('') || '<tr><td colspan="7">No data</td></tr>';
  }

  window.setView = v => { currentView = v; document.querySelectorAll('.view-toggle button').forEach(b => b.classList.toggle('active', b.textContent.toLowerCase() === v)); renderHeatmap(); };
  window.showTooltip = (e, uid) => {
    const tt = $('unit-tooltip'), c = $('tooltip-content'), cell = e.target;
    const sev = heatmapData.severity_matrix[cell.dataset.floor]?.[M.WINGS.indexOf(cell.dataset.wing)]?.[cell.dataset.unit] || 0;
    const mst = heatmapData.moisture_matrix[cell.dataset.floor]?.[M.WINGS.indexOf(cell.dataset.wing)]?.[cell.dataset.unit] || 0;
    c.innerHTML = `<div style="font-weight:600;margin-bottom:0.5rem;">Unit ${uid}</div><div style="font-size:0.875rem;"><div>Severity: ${M.severityBadge(sev)}</div><div style="margin-top:0.25rem;">Moisture: ${(mst * 100).toFixed(0)}%</div></div><div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.5rem;">Click to view</div>`;
    tt.style.display = 'block'; tt.style.left = (e.clientX + 10) + 'px'; tt.style.top = (e.clientY + 10) + 'px';
  };
  window.hideTooltip = () => $('unit-tooltip').style.display = 'none';
  window.goToUnit = uid => location.href = `../unit/?id=${uid}`;
  init();
})();
