async function fetchOptions() {
 const res = await fetch('/api/options');
 return res.json();
}

/* Theme toggle: persist preferred theme in localStorage and apply with data-theme attr */
const THEMES = { DARK: 'dark', LIGHT: 'light' };
function applyTheme(t) {
  const isDark = t === THEMES.DARK;
  if (isDark) document.documentElement.setAttribute('data-theme', 'dark');
  else document.documentElement.removeAttribute('data-theme');
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    btn.textContent = isDark ? '☀️' : '🌙';
    btn.setAttribute('aria-pressed', isDark);
  }
}
function loadTheme() {
  try {
    const saved = localStorage.getItem('theme');
    if (saved) { applyTheme(saved); return; }
  } catch (e) { /* ignore storage errors */ }
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(prefersDark ? THEMES.DARK : THEMES.LIGHT);
}
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') === 'dark' ? THEMES.DARK : THEMES.LIGHT;
  const next = current === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
  applyTheme(next);
  try { localStorage.setItem('theme', next); } catch (e) {}
}

window.addEventListener('DOMContentLoaded', async () => {
  loadTheme();
 const opts = await fetchOptions();
 const wpSelect = document.getElementById('workpiece_material');
 const tSelect = document.getElementById('tool_material');


 opts.workpieces.forEach(wp => wpSelect.append(new Option(wp, wp)));
 tSelect.append(new Option('(Biarkan sistem memilih)', ''));
 opts.tool_materials.forEach(tm => tSelect.append(new Option(tm, tm)));


 const form = document.getElementById('recForm');
 form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const wp = wpSelect.value;
  const tm = document.getElementById('tool_material').value || null;
  const op = document.getElementById('operation').value || null;


  const res = await fetch('/api/recommend', {
   method: 'POST', headers: {'Content-Type': 'application/json'},
   body: JSON.stringify({workpiece_material: wp, tool_material: tm, operation: op})
  });


  const json = await res.json();
  const out = document.getElementById('jsonOut');
  const result = document.getElementById('result');
  const expl = document.getElementById('explanation');
  result.classList.remove('hidden');


  if (res.ok) {
  // show friendly explanation
   const r = json.recommendation;
   let html = `<strong>Material:</strong> ${r.workpiece} <br>`;
   html += `<strong>Operation:</strong> ${r.operation} <br>`;
   if (r.chosen_tool) {
    html += `<strong>Rekomendasi utama (dipilih sistem):</strong> ${r.chosen_tool}<br>`;
   }
   if (r.general_notes) html += `<em>${r.general_notes}</em><br>`;
   expl.innerHTML = html;


   out.textContent = JSON.stringify(r, null, 2);
   // render a short summary and a readable key/value table
   try {
     const summary = document.getElementById('summary');
     const table = document.getElementById('resultTable');
     const tbody = table && table.querySelector('tbody');
     if (summary) {
       summary.innerHTML = r.chosen_tool ? `<strong>Rekomendasi utama:</strong> ${r.chosen_tool}` : '';
     }
     if (tbody) {
       tbody.innerHTML = '';
       const addRow = (k, v) => {
         const tr = document.createElement('tr');
         const tdK = document.createElement('td');
         tdK.textContent = k;
         const tdV = document.createElement('td');
         if (v === null || v === undefined) tdV.textContent = '—';
         else if (Array.isArray(v)) tdV.textContent = v.join(', ');
         else if (typeof v === 'object') tdV.innerHTML = `<pre style="margin:0">${JSON.stringify(v, null, 2)}</pre>`;
         else tdV.textContent = String(v);
         tr.appendChild(tdK);
         tr.appendChild(tdV);
         tbody.appendChild(tr);
       };
       // iterate deterministic order: prefer common keys first
       const preferred = ['workpiece','operation','chosen_tool','general_notes'];
       preferred.forEach(k => { if (k in r) { addRow(k, r[k]); } });
       Object.keys(r).filter(k => !preferred.includes(k)).forEach(k => addRow(k, r[k]));
       table.classList.remove('hidden');
     }
   } catch (e) {
     // if something goes wrong with rendering, leave raw JSON visible
     console.warn('Table render failed', e);
   }
  // render kid-friendly summary
  try {
    const friendly = document.getElementById('friendlyDetails');
    if (friendly) {
      friendly.innerHTML = '';
      const r = json.recommendation;
      // short intro sentence
      const intro = document.createElement('p');
      intro.style.margin = '0';
      const opText = (r.operation && r.operation !== 'unspecified') ? r.operation : 'umum';
      if (r.chosen_tool) {
        intro.innerHTML = `Untuk bahan <strong>${r.workpiece}</strong> saat <strong>${opText}</strong>, rekomendasi utama adalah <strong>${r.chosen_tool}</strong>.`;
      } else {
        const opts = Object.keys(r.recommendations || {}).join(', ');
        intro.innerHTML = `Untuk bahan <strong>${r.workpiece}</strong> saat <strong>${opText}</strong>, ada beberapa pilihan pahat: ${opts}.`;
      }
      friendly.appendChild(intro);

      // per-tool simple lists
      const recs = r.recommendations || {};
      Object.keys(recs).forEach(tool => {
        const box = document.createElement('div');
        box.style.marginTop = '0.6rem';
        const h = document.createElement('h3');
        h.textContent = `Pahat: ${tool}`;
        h.style.margin = '0 0 0.3rem 0';
        h.style.fontSize = '1rem';
        box.appendChild(h);

        const ul = document.createElement('ul');
        ul.style.margin = '0 0 0 1rem';
        ul.style.padding = '0';
        const rec = recs[tool];
        const map = {
          'rake': 'Sudut rake',
          'clearance': 'Sudut clearance',
          'nose_radius': 'Jari-jari ujung (nose radius)',
          'edge_condition': 'Kondisi tepi',
          'remarks': 'Catatan'
        };
        Object.keys(rec).forEach(k => {
          const li = document.createElement('li');
          const label = map[k] || k;
          let val = rec[k];
          if (typeof val === 'object') val = JSON.stringify(val);
          // make kid-friendly phrases for some keys
          if (k === 'rake') val = `Gunakan sudut sekitar ${val}`;
          if (k === 'clearance') val = `Sisihkan sudut sekitar ${val}`;
          if (k === 'nose_radius') val = `Bentuk ujung sekitar ${val}`;
          li.textContent = `${label}: ${val}`;
          ul.appendChild(li);
        });
        box.appendChild(ul);
        friendly.appendChild(box);
      });

      if (r.general_notes) {
        const notes = document.createElement('p');
        notes.className = 'muted';
        notes.style.marginTop = '0.6rem';
        notes.innerHTML = `<strong>Catatan umum:</strong> ${r.general_notes}`;
        friendly.appendChild(notes);
      }

      friendly.classList.remove('hidden');
    }
  } catch (e) {
    console.warn('Friendly render failed', e);
  }
 } else {
   expl.innerHTML = '<strong>Terjadi kesalahan:</strong>';
   out.textContent = JSON.stringify(json, null, 2);
   }
 });

    // wire theme toggle button after DOM ready
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
});