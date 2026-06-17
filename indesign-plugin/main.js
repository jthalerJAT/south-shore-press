/* South Shore Press — Page Builder (UXP panel logic).
 * Fetches the portal's token-guarded print API and hands the spec + data to
 * the builder (build-from-spec.js, which exposes window.buildPage). */

function $(id) {
  return document.getElementById(id);
}

function log(msg) {
  const el = $('log');
  el.textContent += msg + '\n';
  el.scrollTop = el.scrollHeight;
}

function getStore(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch (e) {
    return fallback;
  }
}
function setStore(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    /* localStorage may be unavailable in UXP — ignore */
  }
}

async function api(path) {
  const base = $('base').value.replace(/\/+$/, '');
  const token = $('token').value.trim();
  if (!base) throw new Error('Set the Portal URL first.');
  if (!token) throw new Error('Set the API token first.');
  const resp = await fetch(base + path, {
    headers: { 'x-ssp-print-token': token },
  });
  if (!resp.ok) {
    if (resp.status === 401) throw new Error('Unauthorized — check the API token.');
    throw new Error('HTTP ' + resp.status);
  }
  return resp.json();
}

async function loadIssue() {
  try {
    log('Loading issue…');
    const { pages } = await api('/api/print/issue');
    const sel = $('page');
    sel.innerHTML = '';
    const buildable = pages.filter((p) => p.mode === 'template');
    if (buildable.length === 0) {
      sel.innerHTML = '<option value="">(no template pages yet)</option>';
      log('No template pages found (only the Front Page / covers build for now).');
      return;
    }
    buildable.forEach((p) => {
      const o = document.createElement('option');
      o.value = p.id;
      o.textContent = p.ordinal + '. ' + p.title;
      sel.appendChild(o);
    });
    log('Loaded ' + buildable.length + ' template page(s).');
  } catch (e) {
    log('Load failed: ' + e.message);
  }
}

async function build() {
  try {
    const id = $('page').value;
    if (!id) {
      log('Pick a page first.');
      return;
    }
    log('Fetching page data…');
    const { meta, data, spec, message } = await api('/api/print/page/' + id);
    if (!spec) {
      log(message || 'No layout spec for this page kind yet.');
      return;
    }
    log('Building "' + meta.title + '" in InDesign…');
    await window.buildPage(spec, data, log);
    log('✓ Done — a new document was created.');
  } catch (e) {
    log('Build failed: ' + e.message);
  }
}

window.addEventListener('load', () => {
  $('base').value = getStore('ssp_base', 'https://south-shore-press.vercel.app');
  $('token').value = getStore('ssp_token', '');
  $('base').addEventListener('change', () => setStore('ssp_base', $('base').value));
  $('token').addEventListener('change', () => setStore('ssp_token', $('token').value));
  $('load').addEventListener('click', loadIssue);
  $('build').addEventListener('click', build);
});

// Register the panel entrypoint (id must match manifest.json).
try {
  require('uxp').entrypoints.setup({ panels: { sspPanel: {} } });
} catch (e) {
  /* older UXP host — panel still loads from manifest */
}
