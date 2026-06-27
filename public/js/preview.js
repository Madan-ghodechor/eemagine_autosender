/* Preview page — table search, column toggle, tabs, pagination */
(function () {
  const PAGE_SIZE = 20;
  let currentPage = 1;
  let visibleCols = [];
  let filteredRows = [];

  const tableBody   = document.getElementById('tableBody');
  const tableHead   = document.getElementById('tableHead');
  const searchInput = document.getElementById('searchInput');
  const paginationEl= document.getElementById('pagination');
  const countEl     = document.getElementById('rowCount');
  const colPills    = document.querySelectorAll('.col-pill');

  if (!tableBody) return;

  // Gather all raw rows from the data attribute on <tbody>
  const allRows = JSON.parse(document.getElementById('tableData').textContent || '[]');
  const columns = allRows.length ? Object.keys(allRows[0]) : [];

  // Column visibility
  visibleCols = [...columns];

  colPills.forEach((pill) => {
    pill.classList.add('on');
    pill.addEventListener('click', () => {
      const col = pill.dataset.col;
      pill.classList.toggle('on');
      if (visibleCols.includes(col)) {
        visibleCols = visibleCols.filter((c) => c !== col);
      } else {
        visibleCols.push(col);
      }
      currentPage = 1;
      render();
    });
  });

  // Search
  searchInput?.addEventListener('input', () => { currentPage = 1; render(); });

  function filter() {
    const q = searchInput?.value.toLowerCase() || '';
    if (!q) return allRows;
    return allRows.filter((row) =>
      columns.some((col) => String(row[col] ?? '').toLowerCase().includes(q))
    );
  }

  function render() {
    filteredRows = filter();
    const total = filteredRows.length;
    const pages = Math.ceil(total / PAGE_SIZE) || 1;
    currentPage = Math.min(currentPage, pages);

    const start = (currentPage - 1) * PAGE_SIZE;
    const pageRows = filteredRows.slice(start, start + PAGE_SIZE);

    // Header
    tableHead.innerHTML = '<tr>' + visibleCols.map((c) =>
      `<th>${escHtml(c)}</th>`
    ).join('') + '</tr>';

    // Body
    tableBody.innerHTML = pageRows.length
      ? pageRows.map((row) =>
          '<tr>' + visibleCols.map((c) => `<td>${escHtml(String(row[c] ?? ''))}</td>`).join('') + '</tr>'
        ).join('')
      : `<tr><td colspan="${visibleCols.length}" style="text-align:center;color:var(--muted);padding:32px">No matching rows</td></tr>`;

    // Count
    if (countEl) countEl.textContent = `${total.toLocaleString()} row${total !== 1 ? 's' : ''}`;

    // Pagination
    if (paginationEl) {
      paginationEl.innerHTML = '';
      if (pages <= 1) return;
      const makeBtn = (label, page, active = false, disabled = false) => {
        const btn = document.createElement('a');
        btn.href = '#';
        btn.className = 'page-btn' + (active ? ' active' : '');
        btn.textContent = label;
        if (!disabled && !active) {
          btn.addEventListener('click', (e) => { e.preventDefault(); currentPage = page; render(); });
        }
        return btn;
      };
      if (currentPage > 1) paginationEl.appendChild(makeBtn('‹ Prev', currentPage - 1));
      const range = pageRange(currentPage, pages);
      range.forEach((p) => {
        if (p === '…') {
          const span = document.createElement('span');
          span.className = 'page-btn';
          span.textContent = '…';
          paginationEl.appendChild(span);
        } else {
          paginationEl.appendChild(makeBtn(p, p, p === currentPage));
        }
      });
      if (currentPage < pages) paginationEl.appendChild(makeBtn('Next ›', currentPage + 1));
    }
  }

  function pageRange(cur, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const result = [1];
    if (cur > 3) result.push('…');
    for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) result.push(i);
    if (cur < total - 2) result.push('…');
    result.push(total);
    return result;
  }

  function escHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // Tabs
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });

  render();
})();
