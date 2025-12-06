/**
 * Dashboard Page - Tag-based rendering
 */
(async function() {
  const T = TagLoader, M = MoldKonomi;
  const tags = await T.loadTags([...T.coreTags, 'labels-setup', 'labels-alerts', 'labels-table', 'labels-modal', 'labels-form']);
  const L = (g, k, f) => T.getLabel(tags, g, k, f);
  const Ls = g => T.getLabels(tags, g);

  const app = document.getElementById('app');
  const setup = Ls('setup'), cards = Ls('cards'), btns = Ls('buttons'), tbl = Ls('table');

  app.innerHTML = `
    ${T.buildNav(tags, 'dashboard')}
    <div class="container">
      <div id="setup-banner" class="card" style="display:none;margin-bottom:2rem;">
        <h3 style="margin-bottom:1rem;">${setup.welcome}</h3>
        <p style="margin-bottom:1rem;color:var(--text-secondary);">${setup.welcomeMsg}</p>
        <div class="grid grid-2" style="gap:1rem;max-width:600px;">
          <div class="form-group" style="margin:0;">
            <label class="form-label">${L('form','apiUrl','API URL')}</label>
            <input type="text" id="api-url" class="form-input" value="${setup.defApiUrl}" placeholder="${setup.defApiUrl}">
          </div>
          <div class="form-group" style="margin:0;">
            <label class="form-label">${L('form','buildingId','Building ID')}</label>
            <input type="text" id="building-id" class="form-input" value="${setup.defBuildingId}" placeholder="${setup.defBuildingId}">
          </div>
        </div>
        <div style="margin-top:1rem;">
          <button id="btn-create-building" class="btn btn-primary">${setup.createBtn}</button>
          <button id="btn-connect" class="btn btn-secondary">${setup.connectBtn}</button>
        </div>
      </div>
      <div id="dashboard" style="display:none;">
        ${T.buildPageHeader(tags, 'dashboard', `<div class="flex gap-1">
          <button id="btn-refresh" class="btn btn-secondary">${btns.refresh}</button>
          <button id="btn-settings" class="btn btn-secondary">${btns.settings}</button>
        </div>`)}
        <div id="stats-container" class="grid grid-4 mb-2">${T.loading()}</div>
        <div id="alert-banner"></div>
        <div class="grid grid-2">
          <div class="card"><div class="card-header"><span class="card-title">${cards.priorityQueue}</span>
            <a href="schedule/" class="btn btn-secondary" style="font-size:0.75rem;padding:0.25rem 0.75rem;">${L('common','view','View All')}</a>
          </div><div id="priority-list">${T.loading()}</div></div>
          <div class="card"><div class="card-header"><span class="card-title">${cards.buildingOverview}</span>
            <a href="heatmap/" class="btn btn-secondary" style="font-size:0.75rem;padding:0.25rem 0.75rem;">${L('common','view','Full View')}</a>
          </div><div id="building-overview">${T.loading()}</div></div>
        </div>
        <div class="card mt-2"><div class="card-header"><span class="card-title">${cards.zoneStatus}</span></div>
          <div class="table-container"><table><thead><tr>
            <th>${tbl.zone}</th><th>${tbl.units}</th><th>${tbl.affected}</th><th>${L('stats','maxSeverity','Max Severity')}</th><th>${tbl.cost}</th><th>${tbl.hours}</th>
          </tr></thead><tbody id="zone-table"><tr><td colspan="6" class="text-center">${T.loading()}</td></tr></tbody></table></div>
        </div>
      </div>
    </div>
    <div id="settings-modal" class="modal-backdrop"><div class="modal">
      <div class="modal-header"><h3>${L('modal','settingsTitle','Settings')}</h3><button class="modal-close" onclick="closeSettingsModal()">&times;</button></div>
      <div class="modal-body">
        <div class="form-group"><label class="form-label">${L('form','apiUrl','API URL')}</label><input type="text" id="settings-api-url" class="form-input"></div>
        <div class="form-group"><label class="form-label">${L('form','wsUrl','WebSocket URL')}</label><input type="text" id="settings-ws-url" class="form-input"></div>
        <div class="form-group"><label class="form-label">${L('form','buildingId','Building ID')}</label><input type="text" id="settings-building-id" class="form-input"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeSettingsModal()">${L('common','cancel','Cancel')}</button>
        <button class="btn btn-primary" onclick="saveSettings()">${L('common','save','Save')}</button>
      </div>
    </div></div>`;

  const $ = id => document.getElementById(id);
  const alerts = Ls('alerts');

  async function init() {
    if (!M.getConfig('buildingId')) showSetup();
    else { showDashboard(); await loadDashboardData(); }
    setupEvents();
  }

  function showSetup() { $('setup-banner').style.display = 'block'; $('dashboard').style.display = 'none'; $('api-url').value = M.getConfig('apiUrl'); }
  function showDashboard() { $('setup-banner').style.display = 'none'; $('dashboard').style.display = 'block'; $('page-subtitle').textContent = `Building: ${M.getConfig('buildingId')}`; }

  async function loadDashboardData() {
    try {
      const [stats, pq, hm] = await Promise.all([M.getStatistics(), M.getPriorityQueue(), M.getHeatmap()]);
      M.renderStatCards($('stats-container'), stats);
      M.renderPriorityList($('priority-list'), pq.units, 5);
      M.renderHeatmap($('building-overview'), hm);
      renderAlerts(stats);
      loadZoneData(hm);
    } catch (e) { M.showError($('stats-container'), `Failed to load: ${e.message}`); }
  }

  function loadZoneData(hm) {
    const zones = hm.zone_summaries || {};
    $('zone-table').innerHTML = Object.entries(zones).map(([z, d]) => `<tr>
      <td><a href="zone/?zone=${z}">${z}</a></td><td>${d.total_units}</td><td>${d.affected_units}</td>
      <td>${M.severityBadge(d.max_severity)}</td><td>--</td><td>--</td></tr>`).join('') || '<tr><td colspan="6" class="text-center">No zone data</td></tr>';
  }

  function renderAlerts(s) {
    const c = s.severity_distribution?.CRITICAL || 0, sv = s.severity_distribution?.SEVERE || 0;
    $('alert-banner').innerHTML = c > 0 ? `<div class="alert alert-critical">${alerts.criticalPrefix} ${c} ${alerts.criticalMsg}</div>`
      : sv > 5 ? `<div class="alert alert-warning">${alerts.warningPrefix} ${sv} ${alerts.warningMsg}</div>` : '';
  }

  function setupEvents() {
    $('btn-create-building').onclick = async () => {
      M.setConfig('apiUrl', $('api-url').value);
      try { await M.createBuilding($('building-id').value); showDashboard(); await loadDashboardData(); }
      catch (e) { alert(`Failed: ${e.message}`); }
    };
    $('btn-connect').onclick = async () => {
      M.setConfig('apiUrl', $('api-url').value); M.setConfig('buildingId', $('building-id').value);
      try { await M.getStatistics(); showDashboard(); await loadDashboardData(); }
      catch (e) { alert(`Failed: ${e.message}`); }
    };
    $('btn-refresh').onclick = loadDashboardData;
    $('btn-settings').onclick = () => { $('settings-api-url').value = M.getConfig('apiUrl'); $('settings-ws-url').value = M.getConfig('wsUrl'); $('settings-building-id').value = M.getConfig('buildingId') || ''; $('settings-modal').classList.add('active'); };
    M.wsSubscribe('updates', loadDashboardData);
  }

  window.closeSettingsModal = () => $('settings-modal').classList.remove('active');
  window.saveSettings = () => { M.setConfig('apiUrl', $('settings-api-url').value); M.setConfig('wsUrl', $('settings-ws-url').value); M.setConfig('buildingId', $('settings-building-id').value); closeSettingsModal(); location.reload(); };

  init();
})();
