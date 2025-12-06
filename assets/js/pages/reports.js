/**
 * Reports Page - Tag-based rendering
 */
(async function() {
  const T = TagLoader, M = MoldKonomi;
  const tags = await T.loadTags([...T.coreTags, 'labels-reports', 'labels-table']);
  const L = (g, k, f) => T.getLabel(tags, g, k, f);
  const reports = T.getLabels(tags, 'reports'), cards = T.getLabels(tags, 'cards'), tbl = T.getLabels(tags, 'table'), stats = T.getLabels(tags, 'stats');

  const app = document.getElementById('app');
  app.innerHTML = `
    ${T.buildNav(tags, 'reports')}
    <div class="container">
      ${T.buildPageHeader(tags, 'reports')}
      <div class="grid grid-4 mb-2">${Object.entries(reports).map(([k, r]) => `<div class="card report-card" onclick="loadReport('${k}')">
        <div class="report-icon">${r.i}</div><div class="report-title">${r.t}</div><div class="report-desc">${r.d}</div></div>`).join('')}</div>
      <div class="card" id="report-panel" style="display:none;">
        <div class="card-header"><span class="card-title" id="report-title">Report</span>
          <div><button class="btn btn-secondary" onclick="copyReport()">📋 ${L('common','copy','Copy')}</button>
            <button class="btn btn-secondary" onclick="downloadReport()">⬇️ ${L('common','download','Download')}</button>
            <button class="btn btn-secondary" onclick="closeReport()">✕ ${L('common','close','Close')}</button></div></div>
        <div id="report-content"></div>
      </div>
      <div class="card mt-2"><div class="card-header"><span class="card-title">${cards.currentStats}</span>
        <button class="btn btn-secondary" onclick="refreshStats()" style="font-size:0.75rem;">↻ ${L('common','refresh','Refresh')}</button></div>
        <div id="stats-content">${T.loading()}</div>
      </div>
    </div>
    <style>.report-card{cursor:pointer;transition:transform 0.2s,box-shadow 0.2s;}.report-card:hover{transform:translateY(-2px);box-shadow:var(--shadow);}.report-icon{font-size:2.5rem;margin-bottom:1rem;}.report-title{font-size:1.125rem;font-weight:600;margin-bottom:0.5rem;}.report-desc{font-size:0.875rem;color:var(--text-secondary);}.report-viewer{background:var(--bg-dark);border:1px solid var(--border);border-radius:var(--radius);padding:2rem;font-family:monospace;font-size:0.875rem;white-space:pre-wrap;overflow-x:auto;max-height:600px;overflow-y:auto;}.risk-badge{display:inline-block;padding:0.5rem 1rem;border-radius:var(--radius);font-weight:600;text-transform:uppercase;}.risk-CRITICAL{background:var(--severity-critical);color:#fff;}.risk-HIGH{background:var(--severity-severe);color:#fff;}.risk-ELEVATED{background:var(--severity-moderate);color:#000;}.risk-MODERATE{background:var(--severity-minor);color:#000;}.risk-LOW{background:var(--severity-none);color:#fff;}</style>`;

  const $ = id => document.getElementById(id);
  let currentReport = null, currentReportType = '';

  async function init() { await loadStats(); }

  async function loadStats() {
    const con = $('stats-content');
    try {
      const s = await M.getStatistics();
      con.innerHTML = `<div class="grid grid-4" style="gap:1rem;margin-bottom:1rem;">
        ${T.buildStatCard(stats.totalUnits, s.total_units)}
        ${T.buildStatCard(stats.assessed, s.assessed_units)}
        ${T.buildStatCard(stats.affected, s.affected_units, '', s.affected_units > 0 ? 'severe' : 'none')}
        ${T.buildStatCard(stats.estCost, M.formatCurrency(s.total_estimated_cost))}</div>
        <div class="table-container"><table><thead><tr><th>${tbl.severity}</th><th>Count</th><th>% of Total</th></tr></thead><tbody>
          ${Object.entries(s.severity_distribution).map(([l, c]) => `<tr><td>${M.severityBadge(Object.keys(M.SEVERITY).find(k => M.SEVERITY[k].name === l) || 0)}</td><td>${c}</td><td>${(c / s.total_units * 100).toFixed(1)}%</td></tr>`).join('')}</tbody></table></div>`;
    } catch (e) { con.innerHTML = `<div class="alert alert-critical">${e.message}</div>`; }
  }

  async function loadReport(type) {
    const p = $('report-panel'), c = $('report-content'), t = $('report-title');
    currentReportType = type; p.style.display = 'block'; c.innerHTML = T.loading();
    t.textContent = `${reports[type]?.i || ''} ${reports[type]?.t || type}`;
    try {
      let r;
      switch (type) {
        case 'executive': r = await M.getExecutiveReport(); renderExecutive(r); break;
        case 'materials': r = await M.getMaterialsReport(); renderMaterials(r); break;
        case 'schedule': r = await M.getScheduleReport(3, 20); renderSchedule(r); break;
        case 'statistics': r = await M.getStatistics(); c.innerHTML = `<div class="report-viewer">${JSON.stringify(r, null, 2)}</div>`; break;
      }
      currentReport = r;
    } catch (e) { c.innerHTML = `<div class="alert alert-critical">${e.message}</div>`; }
    p.scrollIntoView({ behavior: 'smooth' });
  }

  function renderExecutive(r) {
    $('report-content').innerHTML = `<div style="margin-bottom:2rem;"><div style="display:flex;align-items:center;gap:1rem;margin-bottom:1rem;">
      <span class="risk-badge risk-${r.risk_level}">${r.risk_level} RISK</span><span style="color:var(--text-secondary);">${r.report_date}</span></div>
      <p style="font-size:1.125rem;margin-bottom:1rem;">${r.risk_description}</p></div>
      <h3 style="margin-bottom:1rem;">Key Metrics</h3>
      <div class="grid grid-3" style="gap:1rem;margin-bottom:2rem;">
        ${T.buildStatCard(stats.totalUnits, r.key_metrics.total_units)}
        ${T.buildStatCard(stats.affected, r.key_metrics.affected_units, '', r.key_metrics.affected_units > 0 ? 'severe' : 'none')}
        ${T.buildStatCard(stats.critical, r.key_metrics.critical_units, '', 'critical')}
        ${T.buildStatCard(stats.severe, r.key_metrics.severe_units, '', 'severe')}
        ${T.buildStatCard(stats.estCost, M.formatCurrency(r.key_metrics.estimated_total_cost))}
        ${T.buildStatCard(stats.estHours, M.formatHours(r.key_metrics.estimated_total_hours))}</div>
      <h3 style="margin-bottom:1rem;">Top Priorities</h3>
      <div class="table-container" style="margin-bottom:2rem;"><table><thead><tr><th>Unit</th><th>Severity</th><th>Priority</th><th>Cost</th></tr></thead><tbody>
        ${r.top_priorities.map(u => `<tr><td>${u.unit_id}</td><td>${M.severityBadge(u.severity)}</td><td>${(u.priority_score * 100).toFixed(0)}%</td><td>${M.formatCurrency(u.estimated_cost)}</td></tr>`).join('')}</tbody></table></div>
      <h3 style="margin-bottom:0.5rem;">Recommendation</h3><div class="alert ${r.risk_level === 'CRITICAL' ? 'alert-critical' : 'alert-warning'}">${r.recommendation}</div>`;
  }

  function renderMaterials(r) {
    $('report-content').innerHTML = `<div class="grid grid-2" style="gap:2rem;">
      <div><h3 style="margin-bottom:1rem;">Materials Summary</h3><div class="table-container"><table><thead><tr><th>Material</th><th>Qty</th></tr></thead><tbody>
        ${Object.entries(r.materials_summary || {}).map(([m, q]) => `<tr><td>${m}</td><td>${q}</td></tr>`).join('') || '<tr><td colspan="2">None</td></tr>'}</tbody></table></div></div>
      <div><h3 style="margin-bottom:1rem;">Units by Severity</h3>
        ${Object.entries(r.units_by_severity || {}).map(([s, u]) => `<div style="margin-bottom:1rem;"><div style="font-weight:600;margin-bottom:0.5rem;">${s} (${u.length})</div><div style="font-size:0.875rem;color:var(--text-secondary);">${u.join(', ') || 'None'}</div></div>`).join('')}</div></div>
      <div style="margin-top:2rem;padding-top:1rem;border-top:1px solid var(--border);">${T.buildStatCard(stats.estCost, M.formatCurrency(r.estimated_total_cost || 0))}</div>`;
  }

  function renderSchedule(r) {
    $('report-content').innerHTML = `<div class="grid grid-4" style="gap:1rem;margin-bottom:2rem;">
      ${T.buildStatCard('Days Required', r.estimated_days)}${T.buildStatCard('Units', r.total_units)}
      ${T.buildStatCard(stats.estHours, M.formatHours(r.totals?.hours || 0))}${T.buildStatCard(stats.estCost, M.formatCurrency(r.totals?.cost || 0))}</div>
      <h3 style="margin-bottom:1rem;">Daily Schedule</h3>
      <div class="table-container"><table><thead><tr><th>Day</th><th>Units</th><th>Hours</th><th>Cost</th></tr></thead><tbody>
        ${(r.daily_schedule || []).map(d => `<tr><td>Day ${d.day}</td><td>${d.units.length} (${d.units.map(u => u.unit_id).join(', ')})</td><td>${M.formatHours(d.total_hours)}</td><td>${M.formatCurrency(d.total_cost)}</td></tr>`).join('')}</tbody></table></div>`;
  }

  window.loadReport = loadReport;
  window.copyReport = () => { if (currentReport) { navigator.clipboard.writeText(JSON.stringify(currentReport, null, 2)); alert('Copied!'); } };
  window.downloadReport = () => { if (currentReport) { const b = new Blob([JSON.stringify(currentReport, null, 2)], { type: 'application/json' }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = `mold-report-${currentReportType}-${new Date().toISOString().split('T')[0]}.json`; a.click(); URL.revokeObjectURL(u); } };
  window.closeReport = () => { $('report-panel').style.display = 'none'; currentReport = null; };
  window.refreshStats = loadStats;
  init();
})();
