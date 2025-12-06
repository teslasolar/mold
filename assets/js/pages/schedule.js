/**
 * Schedule Page - Tag-based rendering
 */
(async function() {
  const T = TagLoader, M = MoldKonomi;
  const tags = await T.loadTags([...T.coreTags, 'labels-form']);
  const L = (g, k, f) => T.getLabel(tags, g, k, f);
  const cards = T.getLabels(tags, 'cards'), btns = T.getLabels(tags, 'buttons'), form = T.getLabels(tags, 'form'), stats = T.getLabels(tags, 'stats');

  const app = document.getElementById('app');
  app.innerHTML = `
    ${T.buildNav(tags, 'schedule')}
    <div class="container">
      ${T.buildPageHeader(tags, 'schedule', `<button id="btn-generate" class="btn btn-primary">${btns.generate}</button>`)}
      <div class="card mb-2"><div class="card-header"><span class="card-title">${cards.scheduleParams}</span></div>
        <div class="grid grid-3" style="gap:1rem;">
          <div class="form-group" style="margin:0;"><label class="form-label">${form.crewSize}</label><input type="number" id="param-crew" class="form-input" value="3" min="1" max="20"></div>
          <div class="form-group" style="margin:0;"><label class="form-label">${form.availDays}</label><input type="number" id="param-days" class="form-input" value="20" min="1" max="365"></div>
          <div class="form-group" style="margin:0;"><label class="form-label">${form.hoursDay}</label><input type="number" id="param-hours" class="form-input" value="8" min="1" max="24" step="0.5"></div>
        </div>
      </div>
      <div id="schedule-summary" class="grid grid-4 mb-2" style="display:none;">
        ${T.buildStatCard(L('table','day','Days Required'), '<span id="sum-days">--</span>', '📅')}
        ${T.buildStatCard(L('stats','totalUnits','Units'), '<span id="sum-units">--</span>', '🏠')}
        ${T.buildStatCard(stats.estHours, '<span id="sum-hours">--</span>', '⏱️')}
        ${T.buildStatCard(stats.estCost, '<span id="sum-cost">--</span>', '💰')}
      </div>
      <div class="card mb-2" id="timeline-card" style="display:none;"><div class="card-header"><span class="card-title">${cards.timelineOverview}</span><span id="timeline-status" style="font-size:0.875rem;"></span></div><div id="timeline" class="timeline"></div></div>
      <div class="card mb-2"><div class="card-header"><span class="card-title">${cards.priorityQueue}</span><span style="font-size:0.875rem;color:var(--text-secondary);" id="priority-count">-- units</span></div><div id="priority-list">${T.loading()}</div></div>
      <div id="schedule-container"><p style="text-align:center;color:var(--text-muted);padding:2rem;">Click "Generate Schedule" to create an optimized plan</p></div>
    </div>
    <style>.timeline{display:flex;height:40px;background:var(--bg-hover);border-radius:var(--radius);overflow:hidden;margin-bottom:1rem;}.timeline-day{flex:1;display:flex;align-items:center;justify-content:center;font-size:0.75rem;border-right:1px solid var(--border);cursor:pointer;transition:background 0.2s;}.timeline-day:hover{background:var(--bg-card);}.timeline-day.has-work{background:var(--accent);color:#fff;}.timeline-day.critical{background:var(--severity-critical);}.schedule-day{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:1rem;}.schedule-day-header{padding:1rem;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;}.schedule-day-stats{display:flex;gap:1.5rem;font-size:0.875rem;color:var(--text-secondary);}.schedule-units{padding:0.5rem;}.schedule-unit{display:flex;align-items:center;padding:0.75rem 1rem;border-radius:var(--radius);margin:0.25rem;cursor:pointer;}.schedule-unit:hover{background:var(--bg-hover);}.schedule-unit-id{font-weight:600;min-width:80px;}.schedule-unit-details{flex:1;display:flex;gap:1.5rem;font-size:0.875rem;color:var(--text-secondary);}</style>`;

  const $ = id => document.getElementById(id);
  let scheduleData = null;

  async function init() { await loadPriorityQueue(); $('btn-generate').onclick = generateSchedule; }

  async function loadPriorityQueue() {
    try { const d = await M.getPriorityQueue(); $('priority-count').textContent = `${d.count} units`; M.renderPriorityList($('priority-list'), d.units, 10); }
    catch (e) { $('priority-list').innerHTML = `<div class="alert alert-critical">${e.message}</div>`; }
  }

  async function generateSchedule() {
    const crew = parseInt($('param-crew').value), days = parseInt($('param-days').value), hrs = parseFloat($('param-hours').value);
    $('schedule-container').innerHTML = T.loading();
    try { scheduleData = await M.generateSchedule(crew, days, hrs); renderSchedule(); }
    catch (e) { $('schedule-container').innerHTML = `<div class="alert alert-critical">${e.message}</div>`; }
  }

  function renderSchedule() {
    $('schedule-summary').style.display = 'grid';
    $('sum-days').textContent = scheduleData.estimated_days;
    $('sum-units').textContent = scheduleData.total_units;
    $('sum-hours').textContent = M.formatHours(scheduleData.totals.hours);
    $('sum-cost').textContent = M.formatCurrency(scheduleData.totals.cost);
    $('timeline-card').style.display = 'block';
    renderTimeline();
    renderDailySchedule();
  }

  function renderTimeline() {
    const tl = $('timeline'), st = $('timeline-status'), avail = parseInt($('param-days').value), est = scheduleData.estimated_days;
    st.innerHTML = scheduleData.fits_timeline ? `<span style="color:var(--severity-none);">✓ Fits within ${avail} days</span>`
      : `<span style="color:var(--severity-critical);">⚠ Needs ${est} days (${est - avail} extra)</span>`;
    const dayMap = {}; scheduleData.daily_schedule.forEach(d => dayMap[d.day] = d);
    let html = '';
    for (let d = 1; d <= Math.max(avail, est); d++) {
      const dd = dayMap[d], hasWork = dd && dd.units.length > 0, hasCrit = hasWork && dd.units.some(u => u.severity >= 4);
      html += `<div class="timeline-day${hasWork ? (hasCrit ? ' critical' : ' has-work') : ''}" onclick="scrollToDay(${d})" title="Day ${d}${hasWork ? `: ${dd.units.length} units` : ''}">${d}</div>`;
    }
    tl.innerHTML = html;
  }

  function renderDailySchedule() {
    const con = $('schedule-container');
    if (!scheduleData.daily_schedule.length) { con.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:2rem;">No units to schedule</p>'; return; }
    con.innerHTML = scheduleData.daily_schedule.map(day => `<div class="schedule-day" id="day-${day.day}">
      <div class="schedule-day-header"><h3><span style="background:var(--accent);color:#fff;padding:0.25rem 0.75rem;border-radius:999px;font-size:0.875rem;">Day ${day.day}</span></h3>
        <div class="schedule-day-stats"><span>🏠 ${day.units.length} units</span><span>⏱️ ${M.formatHours(day.total_hours)}</span><span>💰 ${M.formatCurrency(day.total_cost)}</span></div></div>
      <div class="schedule-units">${day.units.map(u => `<div class="schedule-unit" onclick="location.href='../unit/?id=${u.unit_id}'">
        <div class="schedule-unit-id">${u.unit_id}</div><div class="schedule-unit-details">
          <span>${M.severityBadge(u.severity)}</span><span>Priority: ${(u.priority_score * 100).toFixed(0)}%</span>
          <span>⏱️ ${M.formatHours(u.estimated_hours)}</span><span>💰 ${M.formatCurrency(u.estimated_cost)}</span></div></div>`).join('')}</div>
    </div>`).join('');
  }

  window.scrollToDay = d => { const el = $(`day-${d}`); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); el.style.boxShadow = '0 0 20px var(--accent)'; setTimeout(() => el.style.boxShadow = '', 1000); } };
  init();
})();
