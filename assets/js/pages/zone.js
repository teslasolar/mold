/**
 * Zone Page - Tag-based rendering
 */
(async function() {
  const T = TagLoader, M = MoldKonomi;
  const tags = await T.loadTags([...T.coreTags, 'zones', 'labels-table']);
  const L = (g, k, f) => T.getLabel(tags, g, k, f);
  const zones = T.getLabels(tags, 'zones'), cards = T.getLabels(tags, 'cards'), tbl = T.getLabels(tags, 'table');

  const app = document.getElementById('app');
  app.innerHTML = `
    ${T.buildNav(tags, 'zones')}
    <div class="container">
      ${T.buildPageHeader(tags, 'zones')}
      <div class="grid grid-4 mb-2">
        ${Object.entries(zones).map(([z, n]) => `<div class="card zone-card" data-zone="${z}">
          <div class="card-header"><span class="card-title">${n}</span><span class="severity" id="zone-sev-${z}">--</span></div>
          <div class="zone-stats" id="zone-${z}">${T.loading()}</div>
        </div>`).join('')}
      </div>
      <div class="card" id="zone-detail" style="display:none;">
        <div class="card-header"><span class="card-title">${cards.zoneDetail}: <span id="detail-zone-name">--</span></span>
          <button class="btn btn-secondary" onclick="closeZoneDetail()" style="font-size:0.75rem;padding:0.25rem 0.75rem;">${L('common','close','Close')}</button>
        </div><div id="zone-detail-content"></div>
      </div>
      <div class="card mt-2"><div class="card-header"><span class="card-title">${cards.zoneComparison}</span></div>
        <div class="table-container"><table><thead><tr>
          <th>${tbl.zone}</th><th>${L('stats','totalUnits','Total Units')}</th><th>${tbl.affected}</th><th>${tbl.pctAffected}</th>
          <th>${L('stats','avgSeverity','Avg Severity')}</th><th>${L('stats','maxSeverity','Max Severity')}</th><th>${tbl.cost}</th>
        </tr></thead><tbody id="zone-comparison-table"><tr><td colspan="7" class="text-center">${T.loading()}</td></tr></tbody></table></div>
      </div>
    </div>`;

  const $ = id => document.getElementById(id);
  let zoneData = {};

  async function init() {
    const params = new URLSearchParams(location.search);
    await loadAllZones();
    if (params.get('zone') && zones[params.get('zone')]) showZoneDetail(params.get('zone'));
    document.querySelectorAll('.zone-card').forEach(c => { c.style.cursor = 'pointer'; c.onclick = () => showZoneDetail(c.dataset.zone); });
  }

  async function loadAllZones() {
    try {
      const hm = await M.getHeatmap();
      for (const [z, d] of Object.entries(hm.zone_summaries || {})) { zoneData[z] = d; renderZoneCard(z, d); }
      renderComparisonTable(hm.zone_summaries || {});
    } catch (e) { Object.keys(zones).forEach(z => $(`zone-${z}`).innerHTML = `<div class="alert alert-critical">${e.message}</div>`); }
  }

  function renderZoneCard(z, d) {
    const sev = $(`zone-sev-${z}`), con = $(`zone-${z}`);
    sev.className = `severity severity-${d.max_severity}`; sev.textContent = M.SEVERITY[d.max_severity].name;
    con.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;font-size:0.875rem;">
      <div><div class="card-label">${L('stats','totalUnits','Total')}</div><div style="font-size:1.25rem;font-weight:600;">${d.total_units}</div></div>
      <div><div class="card-label">${L('stats','affected','Affected')}</div><div style="font-size:1.25rem;font-weight:600;color:${d.affected_units > 0 ? 'var(--severity-severe)' : 'var(--severity-none)'};">${d.affected_units}</div></div>
      <div><div class="card-label">${L('stats','avgSeverity','Avg')}</div><div style="font-weight:500;">${d.avg_severity.toFixed(2)}</div></div>
      <div><div class="card-label">${L('stats','maxSeverity','Max')}</div><div style="font-weight:500;">${d.max_severity}</div></div></div>`;
    if (d.max_severity >= 3) con.closest('.zone-card').style.borderColor = M.severityColor(d.max_severity);
  }

  function renderComparisonTable(zs) {
    $('zone-comparison-table').innerHTML = Object.entries(zs).sort((a, b) => b[1].affected_units - a[1].affected_units)
      .map(([z, d]) => `<tr onclick="showZoneDetail('${z}')" style="cursor:pointer;">
        <td><strong>${z}</strong></td><td>${d.total_units}</td><td>${d.affected_units}</td>
        <td>${(d.affected_units / d.total_units * 100).toFixed(1)}%</td><td>${d.avg_severity.toFixed(2)}</td>
        <td>${M.severityBadge(d.max_severity)}</td><td>--</td></tr>`).join('') || '<tr><td colspan="7" class="text-center">No data</td></tr>';
  }

  async function showZoneDetail(z) {
    const p = $('zone-detail'), c = $('zone-detail-content');
    $('detail-zone-name').textContent = z; p.style.display = 'block'; c.innerHTML = T.loading();
    try {
      const r = await M.getZoneReport(z);
      c.innerHTML = `<div class="grid grid-4 mb-2" style="gap:1rem;">
        ${T.buildStatCard(L('stats','totalUnits','Total'), r.total_units)}
        ${T.buildStatCard(L('stats','affected','Affected'), r.affected_units, '', r.affected_units > 0 ? 'severe' : 'none')}
        ${T.buildStatCard(L('stats','estCost','Est. Cost'), M.formatCurrency(r.total_cost || 0))}
        ${T.buildStatCard(L('stats','estHours','Est. Hours'), M.formatHours(r.total_hours || 0))}</div>
        ${r.units_needing_action?.length ? `<div class="table-container"><table><thead><tr>
          <th>Unit</th><th>Severity</th><th>Priority</th><th>Cost</th></tr></thead><tbody>
          ${r.units_needing_action.slice(0, 10).map(u => `<tr onclick="location.href='../unit/?id=${u.unit_id}'" style="cursor:pointer;">
            <td>${u.unit_id}</td><td>${M.severityBadge(u.severity)}</td><td>${(u.priority_score * 100).toFixed(0)}%</td>
            <td>${M.formatCurrency(u.estimated_cost)}</td></tr>`).join('')}</tbody></table></div>` : ''}`;
    } catch (e) { c.innerHTML = `<div class="alert alert-critical">${e.message}</div>`; }
    p.scrollIntoView({ behavior: 'smooth' });
  }

  window.showZoneDetail = showZoneDetail;
  window.closeZoneDetail = () => $('zone-detail').style.display = 'none';
  init();
})();
