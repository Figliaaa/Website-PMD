// static/app.js (diperbarui: validasi, error handling, minor cleanup)
async function fetchOptions() {
  const res = await fetch('/api/options');
  return res.json();
}

const THEMES = { DARK: 'dark', LIGHT: 'light' };
function applyTheme(t) {
  const isDark = t === THEMES.DARK;
  if (isDark) document.documentElement.setAttribute('data-theme', 'dark');
  else document.documentElement.removeAttribute('data-theme');
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    btn.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
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

  // populate options
  let opts;
  try {
    opts = await fetchOptions();
  } catch (e) {
    console.error('Gagal memuat opsi:', e);
    // show minimal fallback
    opts = { workpieces: [], tool_materials: [] };
  }

  const wpSelect = document.getElementById('workpiece_material');
  const tSelect = document.getElementById('tool_material');
  if (wpSelect && tSelect) {
    opts.workpieces.forEach(wp => wpSelect.append(new Option(wp, wp)));
    tSelect.append(new Option('(Biarkan sistem memilih)', ''));
    opts.tool_materials.forEach(tm => tSelect.append(new Option(tm, tm)));
  }

  const form = document.getElementById('recForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = document.getElementById('submitBtn');
    const originalText = submitBtn ? submitBtn.innerHTML : null;
    if (submitBtn) {
      submitBtn.innerHTML = '<i class="fas fa-spinner loading"></i> Memproses...';
      submitBtn.disabled = true;
    }

    try {
      const wp = wpSelect ? wpSelect.value : '';
      if (!wp) {
        alert('Pilih material benda kerja terlebih dahulu.');
        return;
      }
      const tm = document.getElementById('tool_material') ? document.getElementById('tool_material').value || null : null;
      const op = document.getElementById('operation') ? document.getElementById('operation').value || null : null;

      let res;
      try {
        res = await fetch('/api/recommend', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workpiece_material: wp, tool_material: tm, operation: op })
        });
      } catch (fetchErr) {
        throw new Error('Gagal terhubung ke server: ' + fetchErr.message);
      }

      let json;
      try {
        json = await res.json();
      } catch (parseErr) {
        throw new Error('Response bukan JSON yang valid');
      }

      const out = document.getElementById('jsonOut');
      const result = document.getElementById('result');
      const expl = document.getElementById('explanation');
      if (result) result.classList.remove('hidden');

      if (res.ok) {
        const data = json.recommendation;
        // Friendly header
        if (expl) {
          let html = `<strong>Material:</strong> ${data.workpiece} <br>`;
          html += `<strong>Operation:</strong> ${data.operation} <br>`;
          if (data.chosen_tool) html += `<strong>Rekomendasi utama (dipilih sistem):</strong> ${data.chosen_tool}<br>`;
          if (data.general_notes) html += `<em>${data.general_notes}</em><br>`;
          expl.innerHTML = html;
        }

        if (out) out.textContent = JSON.stringify(data, null, 2);

        // Render summary/table
        try {
          const summary = document.getElementById('summary');
          const table = document.getElementById('resultTable');
          const tbody = table && table.querySelector('tbody');
          if (summary) {
            summary.innerHTML = data.chosen_tool ? `<strong>Rekomendasi utama:</strong> ${data.chosen_tool}` : '';
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
            const preferred = ['workpiece', 'operation', 'chosen_tool', 'general_notes'];
            preferred.forEach(k => { if (k in data) { addRow(k, data[k]); } });
            Object.keys(data).filter(k => !preferred.includes(k)).forEach(k => addRow(k, data[k]));
            table.classList.remove('hidden');
          }
        } catch (e) {
          console.warn('Table render failed', e);
        }

        // Friendly detailed section
        try {
          const friendly = document.getElementById('friendlyDetails');
          if (friendly) {
            friendly.innerHTML = '';
            const opText = (data.operation && data.operation !== 'unspecified') ? data.operation : 'umum';
            const intro = document.createElement('p');
            intro.style.margin = '0';
            if (data.chosen_tool) {
              intro.innerHTML = `Untuk bahan <strong>${data.workpiece}</strong> saat <strong>${opText}</strong>, rekomendasi utama adalah <strong>${data.chosen_tool}</strong>.`;
            } else {
              const opts = Object.keys(data.recommendations || {}).join(', ') || 'tidak ada';
              intro.innerHTML = `Untuk bahan <strong>${data.workpiece}</strong> saat <strong>${opText}</strong>, ada beberapa pilihan pahat: ${opts}.`;
            }
            friendly.appendChild(intro);

            if (data.operation_details) {
              const opBox = document.createElement('div');
              opBox.style.marginTop = '0.6rem';
              const opH = document.createElement('h3');
              opH.textContent = `Detail Operasi: ${data.operation}`;
              opH.style.margin = '0 0 0.3rem 0';
              opH.style.fontSize = '1rem';
              opBox.appendChild(opH);

              const opUl = document.createElement('ul');
              opUl.style.margin = '0 0 0 1rem';
              opUl.style.padding = '0';
              const opMap = {
                'recommended_tools': 'Pahat yang direkomendasikan',
                'geometry': 'Geometri pahat',
                'cutting_params': 'Parameter pemotongan',
                'coolant': 'Pendingin',
                'chip_control': 'Kontrol chip',
                'preferred_coatings': 'Coating yang disarankan'
              };
              Object.keys(data.operation_details).forEach(k => {
                const li = document.createElement('li');
                const label = opMap[k] || k;
                let val = data.operation_details[k];
                if (typeof val === 'object') val = JSON.stringify(val, null, 2);
                li.innerHTML = `<strong>${label}:</strong> ${val}`;
                opUl.appendChild(li);
              });
              opBox.appendChild(opUl);
              friendly.appendChild(opBox);
            }

            const recs = data.recommendations || {};
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
                if (k === 'rake') val = `Gunakan sudut sekitar ${val}`;
                if (k === 'clearance') val = `Sisihkan sudut sekitar ${val}`;
                if (k === 'nose_radius') val = `Bentuk ujung sekitar ${val}`;
                li.textContent = `${label}: ${val}`;
                ul.appendChild(li);
              });
              box.appendChild(ul);
              friendly.appendChild(box);
            });

            if (data.general_notes) {
              const notes = document.createElement('p');
              notes.className = 'muted';
              notes.style.marginTop = '0.6rem';
              notes.innerHTML = `<strong>Catatan umum:</strong> ${data.general_notes}`;
              friendly.appendChild(notes);
            }

            friendly.classList.remove('hidden');
          }
        } catch (e) {
          console.warn('Friendly render failed', e);
        }

      } else {
        // response not ok
        if (expl) expl.innerHTML = '<strong>Terjadi kesalahan:</strong>';
        if (out) out.textContent = JSON.stringify(json, null, 2);
        // clear details
        const friendly = document.getElementById('friendlyDetails');
        if (friendly) friendly.classList.add('hidden');
        const table = document.getElementById('resultTable');
        if (table) table.classList.add('hidden');
      }

    } catch (err) {
      console.error('Error saat pemrosesan:', err);
      alert(err.message || 'Terjadi kesalahan. Cek console untuk detail.');
    } finally {
      if (submitBtn) {
        submitBtn.innerHTML = originalText || 'Dapatkan Rekomendasi';
        submitBtn.disabled = false;
      }
    }
  });

  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
});
