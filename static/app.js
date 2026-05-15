let selectedFile = null;

const dropZone   = document.getElementById('drop-zone');
const fileInput  = document.getElementById('file-input');
const btnUpload  = document.getElementById('btn-upload');
const nameInput  = document.getElementById('asset-name');

// ── Drag & drop ──────────────────────────────────────────────────────────────
dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});
['dragleave', 'dragend'].forEach(ev =>
  dropZone.addEventListener(ev, () => dropZone.classList.remove('drag-over'))
);
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) setFile(file);
});
dropZone.addEventListener('click', e => {
  if (e.target.closest('button')) return;
  fileInput.click();
});

fileInput.addEventListener('change', e => {
  if (e.target.files[0]) setFile(e.target.files[0]);
});

nameInput.addEventListener('input', updateUploadBtn);

// ── File selection ────────────────────────────────────────────────────────────
function setFile(file) {
  selectedFile = file;
  dropZone.classList.add('has-file');

  const isVideo = file.type.startsWith('video/');
  const previewWrap = document.getElementById('preview-wrap');
  const previewImg  = document.getElementById('preview-img');
  const videoLabel  = document.getElementById('preview-video-label');
  const videoName   = document.getElementById('preview-video-name');
  const dropIcon    = document.getElementById('drop-icon');

  dropIcon.classList.add('hidden');
  previewWrap.classList.remove('hidden');

  if (isVideo) {
    previewImg.classList.add('hidden');
    videoLabel.classList.remove('hidden');
    videoName.textContent = file.name;
  } else {
    videoLabel.classList.add('hidden');
    previewImg.classList.remove('hidden');
    const reader = new FileReader();
    reader.onload = e => { previewImg.src = e.target.result; };
    reader.readAsDataURL(file);
  }

  document.getElementById('drop-label').textContent = file.name;
  document.getElementById('drop-hint').textContent =
    `${file.type || 'unknown type'} · ${formatBytes(file.size)}`;

  if (!nameInput.value) {
    nameInput.value = file.name.replace(/\.[^.]+$/, '');
  }

  updateUploadBtn();
}

function formatBytes(bytes) {
  if (bytes < 1024)       return bytes + ' B';
  if (bytes < 1048576)    return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
  return (bytes / 1073741824).toFixed(2) + ' GB';
}

function updateUploadBtn() {
  btnUpload.disabled = !(selectedFile && nameInput.value.trim());
}

// ── Upload ────────────────────────────────────────────────────────────────────
btnUpload.addEventListener('click', startUpload);

async function startUpload() {
  if (!selectedFile || !nameInput.value.trim()) return;

  btnUpload.disabled = true;
  hide('upload-result');
  hide('upload-error');
  show('upload-progress');
  document.getElementById('progress-label').textContent =
    selectedFile.type.startsWith('video/') ? 'Uploading video… this may take a moment' : 'Uploading image…';

  const fd = new FormData();
  fd.append('file', selectedFile);
  fd.append('name', nameInput.value.trim());

  try {
    const res  = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await res.json();
    hide('upload-progress');

    if (data.error) {
      showError(data.error);
      return;
    }

    showResult(data);

  } catch (err) {
    hide('upload-progress');
    showError('Upload failed: ' + err.message);
  } finally {
    btnUpload.disabled = false;
  }
}

// ── Result ────────────────────────────────────────────────────────────────────
function showResult(data) {
  document.getElementById('result-subtitle').textContent =
    `"${data.name}" was uploaded successfully as a Meta ${data.type}.`;

  const fields = [];
  if (data.id)   fields.push({ label: data.type === 'video' ? 'Video ID' : 'Image ID', value: data.id });
  if (data.hash) fields.push({ label: 'Image Hash', value: data.hash });
  fields.push({ label: 'Asset Type', value: data.type === 'video' ? 'Video' : 'Image' });
  fields.push({ label: 'Asset Name', value: data.name });

  document.getElementById('result-fields').innerHTML = fields.map(f => `
    <div class="result-field">
      <div class="result-field-label">${esc(f.label)}</div>
      <div class="result-field-value">
        <span>${esc(f.value)}</span>
        <button class="btn-copy" onclick="copyText('${esc(f.value)}')" title="Copy">
          <svg viewBox="0 0 20 20" fill="currentColor"><path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/><path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"/></svg>
        </button>
      </div>
    </div>`).join('');

  show('upload-result');
}

function copyText(text) {
  navigator.clipboard.writeText(text).catch(() => {});
}

function showError(msg) {
  const el = document.getElementById('upload-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

// ── Reset ─────────────────────────────────────────────────────────────────────
function resetUpload() {
  selectedFile = null;
  fileInput.value = '';
  nameInput.value = '';
  dropZone.classList.remove('has-file', 'drag-over');
  document.getElementById('drop-icon').classList.remove('hidden');
  document.getElementById('preview-wrap').classList.add('hidden');
  document.getElementById('preview-img').classList.add('hidden');
  document.getElementById('preview-video-label').classList.add('hidden');
  document.getElementById('drop-label').textContent = 'Drag & drop your file here';
  document.getElementById('drop-hint').textContent = 'JPG, PNG, GIF, MP4, MOV and more · Max 4 GB';
  hide('upload-result');
  hide('upload-error');
  hide('upload-progress');
  updateUploadBtn();
}

function show(id) { document.getElementById(id)?.classList.remove('hidden'); }
function hide(id) { document.getElementById(id)?.classList.add('hidden'); }
function esc(s)   { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
