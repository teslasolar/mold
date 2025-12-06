/**
 * 🦠 Mold Konomi - Unified App Router
 * Auto-detects page from URL, loads from tags
 */
(async function() {
  // Detect base path and current page from URL
  const path = location.pathname;
  const base = path.includes('/mold/') ? '/mold/' : '/';
  const depth = (path.replace(base, '').match(/\//g) || []).length;
  const prefix = depth > 0 ? '../'.repeat(depth) : './';

  // Calculate tags path relative to current location
  const tagsBase = prefix + 'tags/instance/hmi/';

  // Load router config
  async function loadTag(name) {
    try {
      const res = await fetch(tagsBase + name + '.tag');
      if (!res.ok) return null;
      const text = await res.text();
      const lines = text.split('\n');
      let inBody = false, data = {};
      for (const line of lines) {
        if (line === '---') { inBody = true; continue; }
        if (inBody) {
          const idx = line.indexOf(':');
          if (idx > 0) {
            let val = line.slice(idx + 1);
            try { val = JSON.parse(val); } catch(e) {}
            data[line.slice(0, idx)] = val;
          }
        }
      }
      return data;
    } catch(e) { return null; }
  }

  // Get page ID from route
  const routes = await loadTag('routes');
  const titles = await loadTag('titles');

  // Match current path to page
  let pageId = 'dashboard';
  if (routes?.data) {
    // Try exact match first, then partial
    const cleanPath = path.replace(base, '/').replace(/index\.html$/, '');
    for (const [route, id] of Object.entries(routes.data)) {
      if (cleanPath === route || cleanPath === route + '/' || cleanPath.endsWith(route)) {
        pageId = id;
        break;
      }
    }
  }

  // Set page title from tags
  if (titles?.data?.[pageId]) {
    document.title = titles.data[pageId];
  }

  // Load page module dynamically
  const script = document.createElement('script');
  script.src = prefix + 'assets/js/pages/' + pageId + '.js';
  script.onerror = () => {
    document.getElementById('app').innerHTML = `
      <div style="padding:2rem;text-align:center;">
        <h2>Page not found: ${pageId}</h2>
        <p><a href="${prefix}">Return to Dashboard</a></p>
      </div>`;
  };
  document.body.appendChild(script);
})();
