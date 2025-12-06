/**
 * Unit Page - Tag-based rendering
 */
(async function() {
  const T = TagLoader, M = MoldKonomi;
  const tags = await T.loadTags([...T.coreTags, 'floors', 'wings', 'labels-form', 'labels-severity', 'labels-source', 'labels-surface', 'labels-table']);
  const L = (g, k, f) => T.getLabel(tags, g, k, f);
  const floors = T.getLabels(tags, 'floors'), wings = T.getLabels(tags, 'wings');
  const severity = T.getLabels(tags, 'severity'), sources = T.getLabels(tags, 'source'), surfaces = T.getLabels(tags, 'surface');
  const cards = T.getLabels(tags, 'cards'), btns = T.getLabels(tags, 'buttons'), tbl = T.getLabels(tags, 'table'), form = T.getLabels(tags, 'form');

  const app = document.getElementById('app');
  app.innerHTML = `
    ${T.buildNav(tags, 'units')}
    <div class="container">
      ${T.buildPageHeader(tags, 'units', `<button id="btn-new-assessment" class="btn btn-primary">${btns.newAssess}</button>`)}
      <div class="card mb-2"><div class="card-header"><span class="card-title">🔍 Select Unit</span></div>
        <div class="grid grid-4" style="gap:1rem;">
          <div class="form-group" style="margin:0;"><label class="form-label">${form.floor}</label>
            <select id="select-floor" class="form-select">${Object.entries(floors).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
          <div class="form-group" style="margin:0;"><label class="form-label">${form.wing}</label>
            <select id="select-wing" class="form-select">${Object.entries(wings).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
          <div class="form-group" style="margin:0;"><label class="form-label">${form.unit}</label>
            <select id="select-unit" class="form-select">${Array.from({length: 11}, (_, i) => `<option value="${i}">Unit ${i}</option>`).join('')}</select></div>
          <div class="form-group" style="margin:0;display:flex;align-items:flex-end;">
            <button id="btn-load-unit" class="btn btn-secondary" style="width:100%;">${btns.loadUnit}</button></div>
        </div>
      </div>
      <div class="grid grid-2">
        <div class="card"><div class="card-header"><span class="card-title">${cards.currentAssessment}</span><span id="unit-id" style="font-weight:600;">--</span></div>
          <div id="unit-details"><p style="color:var(--text-muted);text-align:center;padding:2rem;">Select a unit</p></div></div>
        <div class="card"><div class="card-header"><span class="card-title">${cards.updateAssessment}</span></div>
          <form id="assessment-form">
            <div class="form-group"><label class="form-label">${form.severity}</label>
              <select id="form-severity" class="form-select">${Object.entries(severity).map(([k, v]) => `<option value="${k}">${k} - ${v}</option>`).join('')}</select></div>
            <div class="form-group"><label class="form-label">${form.moisture}</label>
              <input type="range" id="form-moisture" class="form-input" min="0" max="100" value="0" style="padding:0;"><span id="moisture-value">0%</span></div>
            <div class="form-group"><label class="form-label">${form.sqft}</label>
              <input type="number" id="form-sqft" class="form-input" min="0" max="1000" value="0"></div>
            <div class="form-group"><label class="form-label">${form.source}</label>
              <select id="form-source" class="form-select">${Object.entries(sources).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
            <div class="form-group"><label class="form-label">${form.surfaces}</label>
              <div style="display:flex;flex-wrap:wrap;gap:0.5rem;">${Object.entries(surfaces).map(([k, v]) => `<label><input type="checkbox" name="surfaces" value="${k}"> ${v}</label>`).join('')}</div></div>
            <div class="form-group"><label class="form-label">${form.notes}</label>
              <textarea id="form-notes" class="form-input" rows="3" placeholder="..."></textarea></div>
            <button type="submit" class="btn btn-primary" style="width:100%;">${btns.saveAssess}</button>
          </form>
        </div>
      </div>
      <div class="card mt-2"><div class="card-header"><span class="card-title">${cards.allAffected}</span></div>
        <div class="table-container"><table><thead><tr>
          <th>Unit</th><th>${tbl.severity}</th><th>${L('stats','moisture','Moisture')}</th><th>${L('stats','area','Area')}</th>
          <th>${L('stats','source','Source')}</th><th>${tbl.priority}</th><th>${tbl.cost}</th>
        </tr></thead><tbody id="units-table"><tr><td colspan="7" class="text-center">${T.loading()}</td></tr></tbody></table></div>
      </div>
    </div>`;

  const $ = id => document.getElementById(id);
  let currentUnit = null;

  async function init() {
    const params = new URLSearchParams(location.search), uid = params.get('id');
    if (uid) { const p = M.parseUnitId(uid); $('select-floor').value = p.floor; $('select-wing').value = p.wing; $('select-unit').value = p.unit; await loadUnit(); }
    await loadAffectedUnits();
    setupEvents();
  }

  async function loadUnit() {
    const f = parseInt($('select-floor').value), w = $('select-wing').value, u = parseInt($('select-unit').value);
    $('unit-id').textContent = M.makeUnitId(f, w, u);
    try { currentUnit = await M.getUnit(f, w, u); renderUnitDetails(currentUnit); populateForm(currentUnit); }
    catch (e) { $('unit-details').innerHTML = `<div class="alert alert-critical">${e.message}</div>`; }
  }

  function renderUnitDetails(u) {
    $('unit-details').innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
      <div><div class="card-label">${L('stats','severity','Severity')}</div><div style="margin-top:0.25rem;">${M.severityBadge(u.severity)}</div></div>
      <div><div class="card-label">${L('stats','priorityScore','Priority')}</div><div style="font-size:1.5rem;font-weight:700;color:var(--accent);">${(u.priority_score * 100).toFixed(0)}%</div></div>
      <div><div class="card-label">${L('stats','moisture','Moisture')}</div><div style="font-size:1.25rem;font-weight:600;">${(u.moisture_level * 100).toFixed(0)}%</div></div>
      <div><div class="card-label">${L('stats','area','Area')}</div><div style="font-size:1.25rem;font-weight:600;">${u.sqft_affected || u.sqft || 0} sq ft</div></div>
      <div><div class="card-label">${L('stats','source','Source')}</div><div>${u.source || 'None'}</div></div>
      <div><div class="card-label">${L('stats','surfaces','Surfaces')}</div><div>${(u.surfaces || []).join(', ') || 'None'}</div></div>
      <div><div class="card-label">${L('stats','estCost','Cost')}</div><div style="font-size:1.25rem;font-weight:600;">${M.formatCurrency(u.estimated_cost)}</div></div>
      <div><div class="card-label">${L('stats','estHours','Hours')}</div><div style="font-size:1.25rem;font-weight:600;">${M.formatHours(u.estimated_hours)}</div></div></div>`;
  }

  function populateForm(u) {
    $('form-severity').value = u.severity || 0;
    $('form-moisture').value = (u.moisture_level || 0) * 100;
    $('moisture-value').textContent = `${Math.round((u.moisture_level || 0) * 100)}%`;
    $('form-sqft').value = u.sqft_affected || u.sqft || 0;
    $('form-source').value = u.source || 'none';
    $('form-notes').value = u.notes || '';
    document.querySelectorAll('input[name="surfaces"]').forEach(cb => cb.checked = (u.surfaces || []).includes(cb.value));
  }

  async function loadAffectedUnits() {
    try { const d = await M.getPriorityQueue(); renderUnitsTable(d.units); }
    catch (e) { $('units-table').innerHTML = `<tr><td colspan="7" class="text-center">${e.message}</td></tr>`; }
  }

  function renderUnitsTable(units) {
    if (!units.length) { $('units-table').innerHTML = '<tr><td colspan="7" class="text-center" style="color:var(--text-muted);">No affected units</td></tr>'; return; }
    $('units-table').innerHTML = units.map(u => `<tr style="cursor:pointer;" onclick="selectUnitFromTable('${u.unit_id}')">
      <td><strong>${u.unit_id}</strong></td><td>${M.severityBadge(u.severity)}</td>
      <td>${u.moisture_level ? (u.moisture_level * 100).toFixed(0) + '%' : '--'}</td><td>${u.sqft_affected || '--'}</td>
      <td>${u.source || '--'}</td><td style="font-weight:600;color:var(--accent);">${(u.priority_score * 100).toFixed(0)}%</td>
      <td>${M.formatCurrency(u.estimated_cost)}</td></tr>`).join('');
  }

  function setupEvents() {
    $('btn-load-unit').onclick = loadUnit;
    $('form-moisture').oninput = () => $('moisture-value').textContent = `${$('form-moisture').value}%`;
    $('assessment-form').onsubmit = async e => {
      e.preventDefault();
      const data = { severity: parseInt($('form-severity').value), moisture_level: parseInt($('form-moisture').value) / 100,
        sqft_affected: parseInt($('form-sqft').value), source: $('form-source').value,
        surfaces: Array.from(document.querySelectorAll('input[name="surfaces"]:checked')).map(cb => cb.value),
        notes: $('form-notes').value };
      try { await M.assessUnit(parseInt($('select-floor').value), $('select-wing').value, parseInt($('select-unit').value), data);
        alert('Saved!'); await loadUnit(); await loadAffectedUnits(); }
      catch (e) { alert(`Failed: ${e.message}`); }
    };
    $('btn-new-assessment').onclick = () => { $('assessment-form').reset(); $('form-moisture').value = 0; $('moisture-value').textContent = '0%'; };
    M.wsSubscribe('updates', () => { loadAffectedUnits(); if (currentUnit) loadUnit(); });
  }

  window.selectUnitFromTable = uid => { const p = M.parseUnitId(uid); $('select-floor').value = p.floor; $('select-wing').value = p.wing; $('select-unit').value = p.unit; loadUnit(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  init();
})();
