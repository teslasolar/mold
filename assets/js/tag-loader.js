/**
 * 🏷️ Tag Loader - Dynamic UI from .tag files
 * Parses tag files and renders UI components
 */
const TagLoader = (function() {
  const cache = new Map();

  // Calculate path depth from URL
  const path = location.pathname;
  const segments = path.split('/').filter(s => s && s !== 'index.html');
  const depth = segments.length;
  const prefix = depth > 0 ? '../'.repeat(depth) : './';
  const tagsPath = prefix + 'tags/instance/hmi/';

  // Parse .tag file format
  function parseTag(content) {
    const lines = content.trim().split('\n');
    const tag = { meta: {}, data: {} };
    let inBody = false;

    for (const line of lines) {
      if (line === '---') { inBody = true; continue; }
      if (!inBody) {
        if (line.startsWith('#TAG:')) {
          const [, name, type] = line.split(':');
          tag.meta.name = name;
          tag.meta.type = type;
        } else if (line.startsWith('@path:')) tag.meta.path = line.slice(6);
        else if (line.startsWith('%id:')) tag.meta.id = line.slice(4);
      } else {
        const idx = line.indexOf(':');
        if (idx > 0) {
          const key = line.slice(0, idx);
          let val = line.slice(idx + 1);
          if (val.startsWith('{') || val.startsWith('[')) {
            try { val = JSON.parse(val); } catch (e) {}
          }
          tag.data[key] = val;
        }
      }
    }
    return tag;
  }

  // Load tag file
  async function loadTag(name) {
    if (cache.has(name)) return cache.get(name);
    try {
      const res = await fetch(tagsPath + name + '.tag');
      if (!res.ok) throw new Error(`Tag ${name} not found`);
      const tag = parseTag(await res.text());
      cache.set(name, tag);
      return tag;
    } catch (e) {
      console.warn(`Failed to load tag: ${name}`, e);
      return null;
    }
  }

  // Load multiple tags
  async function loadTags(names) {
    const results = {};
    await Promise.all(names.map(async n => {
      results[n] = await loadTag(n);
    }));
    return results;
  }

  // Get label from loaded tags
  function getLabel(tags, group, key, fallback = key) {
    const tag = tags[`labels-${group}`] || tags[group];
    if (!tag?.data?.data) return fallback;
    const data = typeof tag.data.data === 'string' ? JSON.parse(tag.data.data) : tag.data.data;
    return data[key] || fallback;
  }

  // Get labels object
  function getLabels(tags, group) {
    const tag = tags[`labels-${group}`] || tags[group];
    if (!tag?.data?.data) return {};
    return typeof tag.data.data === 'string' ? JSON.parse(tag.data.data) : tag.data.data;
  }

  // Build nav from tags
  function buildNav(tags, activePage = 'dashboard') {
    const app = tags.app?.data || {};
    const navItems = getLabels(tags, 'nav-items');

    return `<nav class="nav">
      <a href="${prefix}" class="nav-logo">${app.logo || '🦠 App'}</a>
      <ul class="nav-links">
        ${Object.entries(navItems).map(([id, item]) => {
          const href = id === 'dashboard' ? prefix : prefix + item.p;
          const active = id === activePage ? ' class="active"' : '';
          return `<li><a href="${href}"${active}>${item.l}</a></li>`;
        }).join('')}
      </ul>
      <div class="nav-status">
        <span class="status-dot disconnected"></span>
        <span id="connection-status">${getLabel(tags, 'common', 'connecting', 'Connecting...')}</span>
      </div>
    </nav>`;
  }

  // Build page header
  function buildPageHeader(tags, pageId, extra = '') {
    const pages = getLabels(tags, 'pages');
    const page = pages[pageId] || { t: pageId, s: '', i: '' };
    return `<div class="page-header flex flex-between flex-center">
      <div>
        <h1 class="page-title">${page.t}</h1>
        <p class="page-subtitle" id="page-subtitle">${page.s}</p>
      </div>
      ${extra}
    </div>`;
  }

  // Build form field
  function buildField(tags, fieldDef) {
    const labels = getLabels(tags, 'form');
    const label = labels[fieldDef.id] || fieldDef.label || fieldDef.id;
    let input = '';

    switch (fieldDef.type) {
      case 'select':
        const opts = typeof fieldDef.opts === 'object' ? fieldDef.opts : getLabels(tags, fieldDef.opts);
        input = `<select id="form-${fieldDef.id}" class="form-select">
          ${Object.entries(opts).map(([k, v]) => `<option value="${k}">${typeof v === 'object' ? v.l || v : v}</option>`).join('')}
        </select>`;
        break;
      case 'range':
        input = `<input type="range" id="form-${fieldDef.id}" class="form-input" min="${fieldDef.min || 0}" max="${fieldDef.max || 100}" value="0">
          <span id="${fieldDef.id}-value">0%</span>`;
        break;
      case 'textarea':
        input = `<textarea id="form-${fieldDef.id}" class="form-input" rows="3" placeholder="${fieldDef.ph || ''}"></textarea>`;
        break;
      case 'checkbox-group':
        const items = typeof fieldDef.opts === 'object' ? fieldDef.opts : getLabels(tags, fieldDef.opts);
        input = `<div style="display:flex;flex-wrap:wrap;gap:0.5rem;">
          ${Object.entries(items).map(([k, v]) => `<label><input type="checkbox" name="${fieldDef.id}" value="${k}"> ${v}</label>`).join('')}
        </div>`;
        break;
      default:
        input = `<input type="${fieldDef.type || 'text'}" id="form-${fieldDef.id}" class="form-input"
          ${fieldDef.min !== undefined ? `min="${fieldDef.min}"` : ''}
          ${fieldDef.max !== undefined ? `max="${fieldDef.max}"` : ''}
          ${fieldDef.value !== undefined ? `value="${fieldDef.value}"` : ''}
          ${fieldDef.ph ? `placeholder="${fieldDef.ph}"` : ''}>`;
    }

    return `<div class="form-group"><label class="form-label">${label}</label>${input}</div>`;
  }

  // Build table headers
  function buildTableHeaders(tags, columns, group = 'table') {
    const labels = getLabels(tags, group);
    return `<tr>${columns.map(col => `<th>${labels[col] || col}</th>`).join('')}</tr>`;
  }

  // Build card with title
  function buildCard(tags, titleKey, content, group = 'cards') {
    const title = getLabel(tags, group, titleKey, titleKey);
    return `<div class="card">
      <div class="card-header"><span class="card-title">${title}</span></div>
      <div id="card-${titleKey}">${content}</div>
    </div>`;
  }

  // Build button
  function buildButton(tags, id, group = 'buttons', style = 'primary') {
    const text = getLabel(tags, group, id, id);
    return `<button id="btn-${id}" class="btn btn-${style}">${text}</button>`;
  }

  // Build stat card
  function buildStatCard(label, value, icon = '', variant = '') {
    return `<div class="stat-card ${variant}">
      ${icon ? `<div class="icon">${icon}</div>` : ''}
      <div class="value">${value}</div>
      <div class="label">${label}</div>
    </div>`;
  }

  // Build loading spinner
  function loading() {
    return '<div class="loading"><div class="spinner"></div></div>';
  }

  // Core tags needed for all pages
  const coreTags = ['app', 'nav-items', 'pages', 'labels-common', 'labels-stats', 'labels-cards', 'labels-buttons'];

  return {
    parseTag,
    loadTag,
    loadTags,
    getLabel,
    getLabels,
    buildNav,
    buildPageHeader,
    buildField,
    buildTableHeaders,
    buildCard,
    buildButton,
    buildStatCard,
    loading,
    coreTags,
    cache,
    prefix,
    tagsPath
  };
})();
