let selectedFile = null;
const uploadLog  = [];  // running list of uploads this session

const dropZone  = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const btnUpload = document.getElementById('btn-upload');
const titleInput = document.getElementById('asset-title');

// ── Drag & drop ──────────────────────────────────────────────────────────────
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
['dragleave', 'dragend'].forEach(ev => dropZone.addEventListener(ev, () => dropZone.classList.remove('drag-over')));
dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('drag-over'); if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]); });
dropZone.addEventListener('click', e => { if (!e.target.closest('button')) fileInput.click(); });
fileInput.addEventListener('change', e => { if (e.target.files[0]) setFile(e.target.files[0]); });
titleInput.addEventListener('input', updateBtn);

function setFile(file) {
  selectedFile = file;
  dropZone.classList.add('has-file');

  const isVideo = file.type.startsWith('video/');
  document.getElementById('drop-icon').classList.add('hidden');
  document.getElementById('preview-wrap').classList.remove('hidden');

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
  document.getElementById('drop-hint').textContent = `${file.type || 'unknown'} · ${formatBytes(file.size)}`;

  if (!titleInput.value) {
    titleInput.value = file.name.replace(/\.[^.]+$/, '');
  }
  updateBtn();
}

function updateBtn() {
  btnUpload.disabled = !(selectedFile && titleInput.value.trim());
}

// ── Upload ────────────────────────────────────────────────────────────────────
btnUpload.addEventListener('click', startUpload);

async function startUpload() {
  if (!selectedFile || !titleInput.value.trim()) return;

  btnUpload.disabled = true;
  hide('upload-error');
  show('upload-progress');
  document.getElementById('progress-label').textContent =
    selectedFile.type.startsWith('video/') ? 'Uploading video… this may take a moment' : 'Uploading image…';

  const fd = new FormData();
  fd.append('file', selectedFile);
  fd.append('title', titleInput.value.trim());

  try {
    const res  = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await res.json();
    hide('upload-progress');

    if (data.error) { showError(data.error); btnUpload.disabled = false; return; }

    if (data.sheet_warning) showError(data.sheet_warning);

    addToLog(data);
    resetForm();

  } catch (err) {
    hide('upload-progress');
    showError('Upload failed: ' + err.message);
  } finally {
    btnUpload.disabled = false;
  }
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
const SHEET_ID = ''; // set via env — link is constructed server-side if needed
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
  selectedFile = null;
  fileInput.value = '';
  titleInput.value = '';
  dropZone.classList.remove('has-file', 'drag-over');
  document.getElementById('drop-icon').classList.remove('hidden');
  document.getElementById('preview-wrap').classList.add('hidden');
  document.getElementById('preview-img').classList.add('hidden');
  document.getElementById('preview-video-label').classList.add('hidden');
  document.getElementById('drop-label').textContent = 'Drag & drop your file here';
  document.getElementById('drop-hint').textContent = 'JPG, PNG, GIF, MP4, MOV and more';
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
