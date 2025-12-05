/**
 * 🦠 Mold Konomi System - Client SDK
 * Browser-side API and WebSocket client
 */

const MoldKonomi = (function() {
  // Configuration
  const config = {
    apiUrl: localStorage.getItem('mold_api_url') || 'http://localhost:3001',
    wsUrl: localStorage.getItem('mold_ws_url') || 'ws://localhost:6789',
    buildingId: localStorage.getItem('mold_building_id') || null
  };

  // WebSocket connection
  let ws = null;
  let wsReconnectAttempts = 0;
  const wsMaxReconnectAttempts = 5;
  const wsListeners = new Map();

  // Severity mappings
  const SEVERITY = {
    0: { name: 'NONE', color: '#238636' },
    1: { name: 'MINOR', color: '#3fb950' },
    2: { name: 'MODERATE', color: '#d29922' },
    3: { name: 'SEVERE', color: '#db6d28' },
    4: { name: 'CRITICAL', color: '#f85149' }
  };

  const WINGS = ['NE', 'NW', 'SE', 'SW'];
  const ZONES = ['NE_LOW', 'NE_HIGH', 'NW_LOW', 'NW_HIGH', 'SE_LOW', 'SE_HIGH', 'SW_LOW', 'SW_HIGH'];

  // ============ Configuration ============

  function setConfig(key, value) {
    config[key] = value;
    localStorage.setItem(`mold_${key}`, value);
  }

  function getConfig(key) {
    return config[key];
  }

  // ============ REST API ============

  async function api(endpoint, options = {}) {
    const url = `${config.apiUrl}${endpoint}`;
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json'
      }
    };

    try {
      const response = await fetch(url, { ...defaultOptions, ...options });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || `HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  }

  // Building operations
  async function createBuilding(buildingId, floors = 4, wings = 4, unitsPerWing = 11) {
    const result = await api('/building/create', {
      method: 'POST',
      body: JSON.stringify({
        building_id: buildingId,
        floors,
        wings,
        units_per_wing: unitsPerWing
      })
    });
    setConfig('buildingId', buildingId);
    return result;
  }

  async function getBuilding(buildingId = config.buildingId) {
    return api(`/building/${buildingId}`);
  }

  async function getBuildingSummary(buildingId = config.buildingId) {
    return api(`/building/${buildingId}/summary`);
  }

  // Unit operations
  async function assessUnit(floor, wing, unit, data) {
    return api('/unit/assess', {
      method: 'POST',
      body: JSON.stringify({
        building_id: config.buildingId,
        floor,
        wing,
        unit,
        ...data
      })
    });
  }

  async function getUnit(floor, wing, unit) {
    const params = new URLSearchParams({
      f: floor,
      w: wing,
      u: unit,
      building_id: config.buildingId
    });
    return api(`/unit?${params}`);
  }

  async function updateUnit(floor, wing, unit, updates) {
    return api('/unit/update', {
      method: 'POST',
      body: JSON.stringify({
        building_id: config.buildingId,
        floor,
        wing,
        unit,
        ...updates
      })
    });
  }

  // Zone operations
  async function getZoneStatus(zone) {
    return api(`/zone/${zone}?building_id=${config.buildingId}`);
  }

  async function getZoneReport(zone) {
    return api(`/report/zone/${zone}?building_id=${config.buildingId}`);
  }

  // Data operations
  async function getHeatmap() {
    return api(`/heatmap?building_id=${config.buildingId}`);
  }

  async function getPriorityQueue(limit = null) {
    const params = new URLSearchParams({ building_id: config.buildingId });
    if (limit) params.append('limit', limit);
    return api(`/priority-queue?${params}`);
  }

  async function getStatistics() {
    return api(`/statistics?building_id=${config.buildingId}`);
  }

  // Schedule operations
  async function generateSchedule(crewSize = 3, days = 20, hoursPerDay = 8) {
    return api('/schedule/generate', {
      method: 'POST',
      body: JSON.stringify({
        building_id: config.buildingId,
        crew_size: crewSize,
        days,
        hours_per_day: hoursPerDay
      })
    });
  }

  // Reports
  async function getExecutiveReport() {
    return api(`/report/executive?building_id=${config.buildingId}`);
  }

  async function getMaterialsReport() {
    return api(`/report/materials?building_id=${config.buildingId}`);
  }

  async function getScheduleReport(crewSize = 3, days = 20) {
    return api(`/report/schedule?building_id=${config.buildingId}&crew_size=${crewSize}&days=${days}`);
  }

  // Health check
  async function healthCheck() {
    return api('/health');
  }

  // ============ WebSocket ============

  function connectWebSocket() {
    if (ws && ws.readyState === WebSocket.OPEN) {
      return Promise.resolve(ws);
    }

    return new Promise((resolve, reject) => {
      try {
        ws = new WebSocket(config.wsUrl);

        ws.onopen = () => {
          console.log('🦠 WebSocket connected');
          wsReconnectAttempts = 0;
          updateConnectionStatus(true);
          resolve(ws);
        };

        ws.onclose = () => {
          console.log('🦠 WebSocket disconnected');
          updateConnectionStatus(false);
          scheduleReconnect();
        };

        ws.onerror = (error) => {
          console.error('🦠 WebSocket error:', error);
          reject(error);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
          } catch (e) {
            console.error('Failed to parse WebSocket message:', e);
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  function scheduleReconnect() {
    if (wsReconnectAttempts < wsMaxReconnectAttempts) {
      wsReconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, wsReconnectAttempts), 30000);
      console.log(`Reconnecting in ${delay}ms (attempt ${wsReconnectAttempts})`);
      setTimeout(connectWebSocket, delay);
    }
  }

  function handleWebSocketMessage(data) {
    // Emit to listeners
    const channel = data.channel || data.action || 'message';
    const listeners = wsListeners.get(channel) || [];
    listeners.forEach(callback => callback(data));

    // Global listeners
    const globalListeners = wsListeners.get('*') || [];
    globalListeners.forEach(callback => callback(data));
  }

  function updateConnectionStatus(connected) {
    const statusDot = document.querySelector('.status-dot');
    if (statusDot) {
      statusDot.classList.toggle('disconnected', !connected);
    }
    // Emit connection status
    handleWebSocketMessage({ channel: 'connection', connected });
  }

  function wsSend(data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  function wsSubscribe(channel, callback) {
    if (!wsListeners.has(channel)) {
      wsListeners.set(channel, []);
    }
    wsListeners.get(channel).push(callback);

    // Send subscribe message if connected
    if (channel !== '*' && channel !== 'connection') {
      wsSend({ action: 'subscribe', channel });
    }

    // Return unsubscribe function
    return () => {
      const listeners = wsListeners.get(channel);
      const index = listeners.indexOf(callback);
      if (index > -1) listeners.splice(index, 1);
    };
  }

  // WebSocket actions
  function wsScanUnit(floor, wing, unit, data = {}) {
    return wsSend({
      action: 'scan_unit',
      building_id: config.buildingId,
      floor,
      wing,
      unit,
      ...data
    });
  }

  function wsUpdateSeverity(unitId, level, notes = '') {
    return wsSend({
      action: 'update_severity',
      building_id: config.buildingId,
      unit_id: unitId,
      level,
      notes
    });
  }

  function wsGetZoneStatus(zone) {
    return wsSend({
      action: 'get_zone_status',
      building_id: config.buildingId,
      zone
    });
  }

  function wsGetPriorityList(limit = null) {
    return wsSend({
      action: 'priority_list',
      building_id: config.buildingId,
      limit
    });
  }

  // ============ Utilities ============

  function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  function formatHours(hours) {
    if (hours < 1) return `${Math.round(hours * 60)} min`;
    return `${hours.toFixed(1)} hrs`;
  }

  function severityBadge(level) {
    const s = SEVERITY[level] || SEVERITY[0];
    return `<span class="severity severity-${level}">${s.name}</span>`;
  }

  function severityColor(level) {
    return SEVERITY[level]?.color || SEVERITY[0].color;
  }

  function parseUnitId(unitId) {
    const parts = unitId.split('-');
    return {
      floor: parseInt(parts[0]),
      wing: parts[1],
      unit: parseInt(parts[2])
    };
  }

  function makeUnitId(floor, wing, unit) {
    return `${floor}-${wing}-${unit}`;
  }

  // ============ UI Helpers ============

  function renderPriorityList(container, units, limit = 10) {
    const html = units.slice(0, limit).map((unit, index) => `
      <div class="priority-item" data-unit-id="${unit.unit_id}">
        <div class="priority-rank">${index + 1}</div>
        <div class="priority-info">
          <div class="priority-unit">Unit ${unit.unit_id}</div>
          <div class="priority-details">
            ${severityBadge(unit.severity)} · ${formatHours(unit.estimated_hours)} · ${formatCurrency(unit.estimated_cost)}
          </div>
        </div>
        <div class="priority-score">${(unit.priority_score * 100).toFixed(0)}%</div>
      </div>
    `).join('');
    container.innerHTML = html || '<p class="text-center" style="color: var(--text-muted);">No affected units</p>';
  }

  function renderHeatmap(container, heatmapData) {
    const { severity_matrix, floors, wings } = heatmapData;
    const unitsPerWing = severity_matrix[0]?.[0]?.length || 11;

    let html = '<div class="building-grid">';

    wings.forEach((wingName, wingIndex) => {
      html += `<div class="wing-section">
        <div class="wing-header">${wingName} Wing</div>`;

      for (let f = floors - 1; f >= 0; f--) {
        html += `<div class="floor-row">
          <span class="floor-label">F${f}</span>`;

        for (let u = 0; u < unitsPerWing; u++) {
          const severity = severity_matrix[f]?.[wingIndex]?.[u] || 0;
          const unitId = makeUnitId(f, wingName, u);
          html += `<div class="unit-cell heatmap-cell"
                       data-severity="${severity}"
                       data-unit-id="${unitId}"
                       title="Unit ${unitId}: ${SEVERITY[severity].name}"></div>`;
        }

        html += '</div>';
      }

      html += '</div>';
    });

    html += '</div>';
    container.innerHTML = html;

    // Add click handlers
    container.querySelectorAll('.unit-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        const unitId = cell.dataset.unitId;
        window.location.href = `unit/?id=${unitId}`;
      });
    });
  }

  function renderStatCards(container, stats) {
    const html = `
      <div class="stat-card">
        <div class="icon">🏢</div>
        <div class="value">${stats.total_units}</div>
        <div class="label">Total Units</div>
      </div>
      <div class="stat-card ${stats.affected_units > 0 ? 'severe' : 'none'}">
        <div class="icon">⚠️</div>
        <div class="value">${stats.affected_units}</div>
        <div class="label">Affected Units</div>
      </div>
      <div class="stat-card critical">
        <div class="icon">🚨</div>
        <div class="value">${stats.severity_distribution?.CRITICAL || 0}</div>
        <div class="label">Critical</div>
      </div>
      <div class="stat-card">
        <div class="icon">💰</div>
        <div class="value">${formatCurrency(stats.total_estimated_cost || 0)}</div>
        <div class="label">Estimated Cost</div>
      </div>
    `;
    container.innerHTML = html;
  }

  function showLoading(container) {
    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  }

  function showError(container, message) {
    container.innerHTML = `<div class="alert alert-critical">${message}</div>`;
  }

  // ============ Public API ============

  return {
    // Config
    setConfig,
    getConfig,
    config,

    // Constants
    SEVERITY,
    WINGS,
    ZONES,

    // REST API
    api,
    createBuilding,
    getBuilding,
    getBuildingSummary,
    assessUnit,
    getUnit,
    updateUnit,
    getZoneStatus,
    getZoneReport,
    getHeatmap,
    getPriorityQueue,
    getStatistics,
    generateSchedule,
    getExecutiveReport,
    getMaterialsReport,
    getScheduleReport,
    healthCheck,

    // WebSocket
    connectWebSocket,
    wsSend,
    wsSubscribe,
    wsScanUnit,
    wsUpdateSeverity,
    wsGetZoneStatus,
    wsGetPriorityList,

    // Utilities
    formatCurrency,
    formatHours,
    severityBadge,
    severityColor,
    parseUnitId,
    makeUnitId,

    // UI Helpers
    renderPriorityList,
    renderHeatmap,
    renderStatCards,
    showLoading,
    showError
  };
})();

// Auto-connect WebSocket on page load
document.addEventListener('DOMContentLoaded', () => {
  MoldKonomi.connectWebSocket().catch(() => {
    console.log('WebSocket not available - running in REST-only mode');
  });
});
