/**
 * Mở HTML báo cáo để In → Lưu PDF.
 * Ưu tiên overlay trong trang (không bị chặn popup) → tab mới → tải file.
 */

const OVERLAY_ID = 'ketcau-report-overlay';

function revokeLater(url: string, ms = 120_000): void {
  window.setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  }, ms);
}

function downloadBlob(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.html') ? filename : `${filename}.html`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Đóng overlay xem trước nếu đang mở */
export function closeReportOverlay(): void {
  const el = document.getElementById(OVERLAY_ID);
  if (el) el.remove();
  document.body.style.overflow = '';
}

function openInOverlay(html: string, filename: string, blobUrl: string): boolean {
  try {
    closeReportOverlay();
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Xem trước báo cáo PDF');
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:99999',
      'background:rgba(15,23,42,.72)',
      'display:flex',
      'flex-direction:column',
      'padding:12px',
      'box-sizing:border-box',
    ].join(';');

    const bar = document.createElement('div');
    bar.style.cssText =
      'flex:0 0 auto;display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;padding:10px 12px;background:#0f172a;color:#fff;border-radius:10px 10px 0 0;font:600 13px system-ui,sans-serif';
    bar.innerHTML = `<span>Xem trước báo cáo — In → chọn «Save as PDF» / «Microsoft Print to PDF»</span>`;

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap';

    const btnPrint = document.createElement('button');
    btnPrint.type = 'button';
    btnPrint.textContent = 'In / Lưu PDF';
    btnPrint.style.cssText =
      'cursor:pointer;border:0;border-radius:8px;padding:8px 14px;font-weight:700;background:#14b8a6;color:#042f2e';

    const btnDl = document.createElement('button');
    btnDl.type = 'button';
    btnDl.textContent = 'Tải HTML';
    btnDl.style.cssText =
      'cursor:pointer;border:1px solid #94a3b8;border-radius:8px;padding:8px 14px;font-weight:600;background:transparent;color:#fff';

    const btnClose = document.createElement('button');
    btnClose.type = 'button';
    btnClose.textContent = 'Đóng';
    btnClose.style.cssText =
      'cursor:pointer;border:1px solid #94a3b8;border-radius:8px;padding:8px 14px;font-weight:600;background:transparent;color:#fff';

    actions.append(btnPrint, btnDl, btnClose);
    bar.appendChild(actions);

    const frameWrap = document.createElement('div');
    frameWrap.style.cssText =
      'flex:1 1 auto;min-height:0;background:#fff;border-radius:0 0 10px 10px;overflow:hidden';

    const iframe = document.createElement('iframe');
    iframe.title = 'Báo cáo';
    iframe.style.cssText = 'width:100%;height:100%;border:0;background:#fff';
    iframe.srcdoc = html;

    frameWrap.appendChild(iframe);
    overlay.append(bar, frameWrap);
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cleanup();
    };
    const cleanup = () => {
      document.removeEventListener('keydown', onKey);
      closeReportOverlay();
      revokeLater(blobUrl, 5_000);
    };

    btnClose.onclick = cleanup;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cleanup();
    });
    document.addEventListener('keydown', onKey);

    btnPrint.onclick = () => {
      try {
        const w = iframe.contentWindow;
        if (!w) return;
        w.focus();
        w.print();
      } catch {
        window.open(blobUrl, '_blank');
      }
    };

    btnDl.onclick = () => {
      downloadBlob(blobUrl, filename);
    };

    return true;
  } catch {
    return false;
  }
}

/** API chính — mọi báo cáo HTML → PDF */
export function openHtmlReport(html: string, filename = 'bao-cao-btct.html'): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const safeName = filename.endsWith('.html') ? filename : `${filename}.html`;

  if (openInOverlay(html, safeName, url)) return;

  const w = window.open(url, '_blank');
  if (w) {
    try {
      w.opener = null;
    } catch {
      /* ignore */
    }
    revokeLater(url, 120_000);
    return;
  }

  downloadBlob(url, safeName);
  revokeLater(url, 30_000);
  alert(
    'Đã tải file HTML báo cáo.\nMở file → Ctrl+P (Cmd+P) → chọn «Save as PDF» / «Microsoft Print to PDF».'
  );
}

/** CSS in A4 dùng chung */
export const PRINT_PAGE_CSS = `
@page {
  size: A4;
  margin: 14mm 12mm 16mm 12mm;
}
@media print {
  html, body {
    background: #fff !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .no-print, .toolbar { display: none !important; }
  .sheet, .report-body {
    margin: 0 !important;
    border: 0 !important;
    box-shadow: none !important;
    max-width: none !important;
    border-radius: 0 !important;
    padding: 0 !important;
  }
  .sec, .sign, tr { page-break-inside: avoid; }
  h1, h2 { page-break-after: avoid; }
  a[href]::after { content: none !important; }
}
`;
