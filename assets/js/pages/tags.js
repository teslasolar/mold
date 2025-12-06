/**
 * Tags Page - Tag-based rendering
 */
(async function() {
  const T = TagLoader;
  const tags = await T.loadTags(['app', 'nav-items', 'labels-tags']);
  const t = T.getLabels(tags, 'tags');

  const app = document.getElementById('app');
  const nav = T.buildNav(tags, 'tags');

  app.innerHTML = `
    ${nav.replace('class="active"', '').replace('href="../tags/"', 'href="./" class="active"')}
    <div class="container">
      <div class="page-header"><h1 class="page-title">${t.pageTitle}</h1><p class="page-subtitle">${t.pageSubtitle}</p></div>
      <div class="card mb-2"><h3>${t.formatTitle}</h3><p style="color:var(--text-secondary);margin-bottom:1rem;">${t.formatDesc}</p>
        <div class="grid grid-2">
          <div><h4>${t.udtTitle}</h4><pre style="background:var(--bg-dark);padding:1rem;border-radius:var(--radius);font-size:0.75rem;overflow-x:auto;">#UDT:S88_Valve:1.0
@base:S88_CM
$std:S88
%cat:Valve
---
opn_cmd:B:0:Open command
cls_cmd:B:0:Close command
opn_fb:B:0:Open feedback
pos:R:0:Position %</pre></div>
          <div><h4>${t.tagTitle}</h4><pre style="background:var(--bg-dark);padding:1rem;border-radius:var(--radius);font-size:0.75rem;overflow-x:auto;">#TAG:XV001:S88_Valve
@path:Main/Area1/Unit1
$inst:Inlet_Valve
%id:A001
---
name:Inlet Isolation
mode:2</pre></div>
        </div>
      </div>
      <div class="grid grid-2 mb-2">
        <div class="card"><div class="card-header"><span class="card-title">${t.s88Title}</span><span style="color:var(--text-muted);">8 types</span></div>
          <table style="font-size:0.875rem;"><thead><tr><th>ID</th><th>Name</th><th>Category</th></tr></thead><tbody>
            <tr><td>0001</td><td>S88_CM</td><td>Control Module</td></tr><tr><td>0002</td><td>S88_EM</td><td>Equipment Module</td></tr>
            <tr><td>0003</td><td>S88_Unit</td><td>Unit</td></tr><tr><td>0004</td><td>S88_Valve</td><td>Valve</td></tr>
            <tr><td>0005</td><td>S88_Motor</td><td>Motor</td></tr><tr><td>0006</td><td>S88_Phase</td><td>Procedural</td></tr>
            <tr><td>0007</td><td>S88_AIn</td><td>Analog Input</td></tr><tr><td>0008</td><td>S88_AOut</td><td>Analog Output</td></tr>
          </tbody></table></div>
        <div class="card"><div class="card-header"><span class="card-title">${t.s95Title}</span><span style="color:var(--text-muted);">6 types</span></div>
          <table style="font-size:0.875rem;"><thead><tr><th>ID</th><th>Name</th><th>Category</th></tr></thead><tbody>
            <tr><td>0010</td><td>S95_Site</td><td>Equipment</td></tr><tr><td>0011</td><td>S95_Area</td><td>Equipment</td></tr>
            <tr><td>0012</td><td>S95_WorkCenter</td><td>Equipment</td></tr><tr><td>0013</td><td>S95_WorkUnit</td><td>Equipment</td></tr>
            <tr><td>0014</td><td>S95_Material</td><td>Resource</td></tr><tr><td>0015</td><td>S95_Personnel</td><td>Resource</td></tr>
          </tbody></table></div>
        <div class="card"><div class="card-header"><span class="card-title">${t.hmiTitle}</span><span style="color:var(--text-muted);">5 types</span></div>
          <table style="font-size:0.875rem;"><thead><tr><th>ID</th><th>Name</th><th>Category</th></tr></thead><tbody>
            <tr><td>0020</td><td>HMI_Screen</td><td>Display</td></tr><tr><td>0021</td><td>HMI_Faceplate</td><td>Widget</td></tr>
            <tr><td>0022</td><td>HMI_Alarm</td><td>Alarm</td></tr><tr><td>0023</td><td>HMI_Trend</td><td>Widget</td></tr>
            <tr><td>0024</td><td>HMI_NavItem</td><td>Navigation</td></tr>
          </tbody></table></div>
        <div class="card"><div class="card-header"><span class="card-title">${t.moldTitle}</span><span style="color:var(--text-muted);">3 types</span></div>
          <table style="font-size:0.875rem;"><thead><tr><th>ID</th><th>Name</th><th>Category</th></tr></thead><tbody>
            <tr><td>0030</td><td>Mold_Assessment</td><td>Mold</td></tr><tr><td>0031</td><td>Mold_Zone</td><td>Mold</td></tr>
            <tr><td>0032</td><td>Mold_Schedule</td><td>Mold</td></tr>
          </tbody></table></div>
      </div>
      <div class="card mb-2"><h3>${t.typeCodes}</h3>
        <div class="grid grid-4" style="font-size:0.875rem;">
          <div><code>B</code> = BOOL</div><div><code>I</code> = INT</div><div><code>D</code> = DINT</div><div><code>R</code> = REAL</div>
          <div><code>S</code> = STRING</div><div><code>T</code> = TIME</div><div><code>DT</code> = DATE_TIME</div><div><code>A[]</code> = Array</div>
          <div><code>U:Name</code> = UDT ref</div><div><code>E:Name</code> = Enum</div></div></div>
      <div class="card"><h3>${t.dirStruct}</h3>
        <pre style="background:var(--bg-dark);padding:1rem;border-radius:var(--radius);font-size:0.75rem;">tags/
├── udt/
│   ├── s88/          # ISA-88 UDTs
│   ├── s95/          # ISA-95 UDTs
│   ├── hmi/          # ISA-101 UDTs
│   └── mold/         # Project UDTs
├── instance/
│   ├── equipment/    # Equipment tags
│   ├── mold/         # Mold tags
│   └── hmi/          # HMI config tags
├── template/         # Templates
└── FORMAT.md         # Spec</pre></div>
    </div>`;
})();
