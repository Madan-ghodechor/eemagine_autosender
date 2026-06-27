/* Upload page interactivity */
(function () {
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const fileNameEl = document.getElementById('fileName');
  const form = document.getElementById('uploadForm');
  const submitBtn = document.getElementById('submitBtn');
  const spinner = submitBtn?.querySelector('.spinner');

  if (!dropZone) return;

  // Drag-and-drop styling
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) setFile(file);
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) setFile(fileInput.files[0]);
  });

  function setFile(file) {
    const allowed = ['.xlsx', '.xls', '.csv'];
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowed.includes(ext)) {
      showAlert('Only .xlsx, .xls and .csv files are allowed.', 'error');
      return;
    }
    // Transfer to real input if dropped
    const dt = new DataTransfer();
    dt.items.add(file);
    fileInput.files = dt.files;

    fileNameEl.textContent = `Selected: ${file.name} (${formatBytes(file.size)})`;
    fileNameEl.style.display = 'block';
  }

  // Submit with spinner
  form?.addEventListener('submit', () => {
    if (!fileInput.files[0]) return;
    if (submitBtn) submitBtn.disabled = true;
    if (spinner) spinner.style.display = 'inline-block';
  });

  function formatBytes(b) {
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
    return (b / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function showAlert(msg, type) {
    const el = document.createElement('div');
    el.className = `alert alert-${type === 'error' ? 'error' : 'info'}`;
    el.textContent = msg;
    form.prepend(el);
    setTimeout(() => el.remove(), 4000);
  }
})();
