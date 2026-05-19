let selectedFiles = [];  // array of File objects
const uploadLog   = [];  // running list of uploads this session
let searchResults = [];  // last search ad rows for CSV export

// ── Tab switching ─────────────────────────────────────────────────────────────
function showTab(tab) {
  document.getElementById('panel-upload').classList.toggle('hidden', tab !== 'upload');
  document.getElementById('panel-search').classList.toggle('hidden', tab !== 'search');
  document.getElementById('nav-upload').classList.toggle('active', tab === 'upload');
  document.getElementById('nav-search').classList.toggle('active', tab === 'search');
}

const dropZone   = document.getElementById('drop-zone');
const fileInput  = document.getElementById('file-input');
const btnUpload  = document.getElementById('btn-upload');
const titleInput = document.getElementById('asset-title');

// ── Drag & drop ──────────────────────────────────────────────────────────────
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
['dragleave', 'dragend'].forEach(ev => dropZone.addEventListener(ev, () => dropZone.classList.remove('drag-over')));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  if (e.dataTransfer.files.length) setFiles(Array.from(e.dataTransfer.files));
});
dropZone.addEventListener('click', e => { if (!e.target.closest('button')) fileInput.click(); });
fileInput.addEventListener('change', e => { if (e.target.files.length) setFiles(Array.from(e.target.files)); });
titleInput.addEventListener('input', updateBtn);

function setFiles(files) {
  selectedFiles = files;
  dropZone.classList.add('has-file');

  // Hide the generic drop icon
  document.getElementById('drop-icon').classList.add('hidden');
  document.getElementById('preview-wrap').classList.remove('hidden');

  if (files.length === 1) {
    const file    = files[0];
    const isVideo = file.type.startsWith('video/');

    if (isVideo) {
      document.getElementById('preview-img').classList.add('hidden');
      document.getElementById('preview-video-label').classList.remove('hidden');
      document.getElementById('preview-video-name').textContent = file.name;
    } else {
      document.getElementById('preview-video-label').classList.add('hidden');
      document.getElementById('preview-img').classList.remove('hidden');
      const reader = new FileReader();
      reader.onload = e => { document.getElementById('preview-img').src = e.target.result; };
      reader.readAsDataURL(file);
    }

    document.getElementById('drop-label').textContent = file.name;
    document.getElementById('drop-hint').textContent  = `${file.type || 'unknown'} · ${formatBytes(file.size)}`;

    if (!titleInput.value) {
      titleInput.value = file.name.replace(/\.[^.]+$/, '');
    }
  } else {
    // Multiple files — show a summary instead of a single preview
    document.getElementById('preview-img').classList.add('hidden');
    document.getElementById('preview-video-label').classList.add('hidden');

    const totalSize = files.reduce((s, f) => s + f.size, 0);
    document.getElementById('drop-label').textContent =
      `${files.length} files selected`;
    document.getElementById('drop-hint').textContent  =
      files.map(f => f.name).join(', ').slice(0, 80) + (files.map(f => f.name).join(', ').length > 80 ? '…' : '')
      + ` · ${formatBytes(totalSize)} total`;
  }

  updateBtn();
}

function updateBtn() {
  btnUpload.disabled = !(selectedFiles.length && titleInput.value.trim());
}

// ── Upload ────────────────────────────────────────────────────────────────────
btnUpload.addEventListener('click', startUpload);

async function startUpload() {
  if (!selectedFiles.length || !titleInput.value.trim()) return;

  btnUpload.disabled = true;
  hide('upload-error');
  show('upload-progress');

  const isbn      = titleInput.value.trim();
  const bookTitle = document.getElementById('asset-book-title').value.trim();
  const total     = selectedFiles.length;
  let   anyError  = false;

  for (let i = 0; i < total; i++) {
    const file    = selectedFiles[i];
    const isVideo = file.type.startsWith('video/');

    document.getElementById('progress-label').textContent =
      total === 1
        ? (isVideo ? 'Uploading video… this may take a moment' : 'Uploading image…')
        : `Uploading file ${i + 1} of ${total}: ${file.name}`;

    const fd = new FormData();
    fd.append('file', file);
    fd.append('title', isbn);
    fd.append('book_title', bookTitle);

    try {
      const res  = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();

      if (data.error) {
        showError(`${file.name}: ${data.error}`);
        anyError = true;
        // continue uploading the rest
      } else {
        if (data.sheet_warning) showError(data.sheet_warning);
        addToLog(data);
      }
    } catch (err) {
      showError(`${file.name}: Upload failed — ${err.message}`);
      anyError = true;
    }
  }

  hide('upload-progress');
  if (!anyError) resetForm();
  else btnUpload.disabled = false;
}

// ── Log table ─────────────────────────────────────────────────────────────────
function addToLog(data) {
  uploadLog.push(data);
  show('history-section');

  const hashOrId = data.hash || data.id || '—';
  const row = document.createElement('tr');
  row.innerHTML = `
    <td><strong>${esc(data.title)}</strong></td>
    <td>${esc(data.meta_name || '—')}</td>
    <td>
      <span class="mono">${esc(hashOrId)}</span>
      <button class="btn-copy" onclick="copyText('${esc(hashOrId)}')" title="Copy">
        <svg viewBox="0 0 20 20" fill="currentColor"><path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/><path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"/></svg>
      </button>
    </td>
    <td><span class="badge ${data.type === 'video' ? 'badge-blue' : 'badge-ok'}">${data.type}</span></td>`;
  document.getElementById('history-tbody').prepend(row);
}

// ── Sheet link ────────────────────────────────────────────────────────────────
async function initSheetLink() {
  try {
    const res  = await fetch('/api/config');
    const data = await res.json();
    if (data.sheet_id) {
      const link = document.getElementById('sheet-link');
      if (link) link.href = `https://docs.google.com/spreadsheets/d/${data.sheet_id}`;
    }
  } catch (_) {}
}
initSheetLink();

// ── Reset form (not the log) ──────────────────────────────────────────────────
function resetForm() {
  selectedFiles = [];
  fileInput.value = '';
  titleInput.value = '';
  document.getElementById('asset-book-title').value = '';
  dropZone.classList.remove('has-file', 'drag-over');
  document.getElementById('drop-icon').classList.remove('hidden');
  document.getElementById('preview-wrap').classList.add('hidden');
  document.getElementById('preview-img').classList.add('hidden');
  document.getElementById('preview-video-label').classList.add('hidden');
  document.getElementById('drop-label').textContent = 'Drag & drop your files here';
  document.getElementById('drop-hint').textContent  = 'JPG, PNG, GIF, MP4, MOV and more · multiple files OK';
  hide('upload-error');
  updateBtn();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function copyText(text) { navigator.clipboard.writeText(text).catch(() => {}); }
function showError(msg) { const el = document.getElementById('upload-error'); el.textContent = msg; el.classList.remove('hidden'); }
function show(id) { document.getElementById(id)?.classList.remove('hidden'); }
function hide(id) { document.getElementById(id)?.classList.add('hidden'); }
function formatBytes(b) { if (b < 1024) return b + ' B'; if (b < 1048576) return (b/1024).toFixed(1)+' KB'; return (b/1048576).toFixed(1)+' MB'; }
function esc(s) { return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ── Search by Title ───────────────────────────────────────────────────────────
const searchInput = document.getElementById('search-query');
const btnSearch   = document.getElementById('btn-search');

searchInput.addEventListener('input', () => {
  btnSearch.disabled = !searchInput.value.trim();
});
searchInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !btnSearch.disabled) runSearch(); });
btnSearch.addEventListener('click', runSearch);

async function runSearch() {
  const query = searchInput.value.trim();
  const days  = parseInt(document.getElementById('search-days').value, 10);
  if (!query) return;

  btnSearch.disabled = true;
  hide('search-results');
  hide('search-empty');
  hide('search-error');
  show('search-progress');

  try {
    const res  = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, days }),
    });
    const data = await res.json();

    if (data.error) {
      showSearchError(data.error);
      return;
    }

    if (!data.ads || data.ads.length === 0) {
      show('search-empty');
      return;
    }

    renderSearchResults(data, days);
  } catch (err) {
    showSearchError('Request failed — ' + err.message);
  } finally {
    hide('search-progress');
    btnSearch.disabled = false;
  }
}

function renderSearchResults(data, days) {
  searchResults = data.ads;

  document.getElementById('search-results-title').textContent =
    `${data.ads.length} ad${data.ads.length !== 1 ? 's' : ''} across ${data.campaigns.length} campaign${data.campaigns.length !== 1 ? 's' : ''} · last ${days} days`;

  const tbody = document.getElementById('search-tbody');
  tbody.innerHTML = '';

  for (const ad of data.ads) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${esc(ad.campaign_name || '—')}</td>
      <td>${esc(ad.adset_name   || '—')}</td>
      <td>${esc(ad.ad_name      || '—')}</td>
      <td class="num">${fmt(ad.impressions)}</td>
      <td class="num">${fmt(ad.clicks)}</td>
      <td class="num">${fmtMoney(ad.spend)}</td>
      <td class="num">${fmtPct(ad.inline_link_click_ctr)}</td>
      <td class="num">${fmtPct(ad.ctr)}</td>
      <td class="num">${fmtMoney(ad.cpc)}</td>
      <td class="num">${fmtMoney(ad.cpm)}</td>
      <td class="num">${fmt(ad.reach)}</td>
      <td class="num">${fmtDec(ad.frequency)}</td>`;
    tbody.appendChild(tr);
  }

  show('search-results');
}

function exportSearchCSV() {
  if (!searchResults.length) return;
  const headers = ['Campaign','Ad Set','Ad Name','Impressions','Clicks','Spend ($)','Link CTR (%)','CTR All (%)','CPC ($)','CPM ($)','Reach','Frequency'];
  const rows = searchResults.map(ad => [
    ad.campaign_name, ad.adset_name, ad.ad_name,
    ad.impressions, ad.clicks, ad.spend,
    ad.inline_link_click_ctr, ad.ctr, ad.cpc, ad.cpm, ad.reach, ad.frequency,
  ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`));

  const csv  = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `campaign_search_${searchInput.value.trim().replace(/\s+/g,'_')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function showSearchError(msg) {
  const el = document.getElementById('search-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function fmt(v)      { return v != null ? Number(v).toLocaleString()                        : '—'; }
function fmtMoney(v) { return v != null ? '$' + Number(v).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2}) : '—'; }
function fmtPct(v)   { return v != null ? Number(v).toFixed(2) + '%'                        : '—'; }
function fmtDec(v)   { return v != null ? Number(v).toFixed(2)                              : '—'; }
