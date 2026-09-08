/**
 * Xuất hồ sơ dự án gộp — Excel + PDF (Dầm · Cột · Sàn · Móng).
 */
import * as XLSX from 'xlsx';
import type { BeamInput, BeamResult } from '../engine/beam';
import type { ColumnInput, ColumnResult } from '../engine/column';
import type { SlabInput, SlabResult } from '../engine/slab';
import type { FoundationInput, FoundationResult } from '../engine/foundation';
import type { ProjectMeta } from './excelReport';

const status = (ok: boolean) => (ok ? 'ĐẠT' : 'KHÔNG ĐẠT');

const defaultMeta = (): Required<ProjectMeta> => ({
  projectName: 'Dự án mẫu',
  designer: 'KS. Thiết kế',
  date: new Date().toLocaleDateString('vi-VN'),
  standard: 'TCVN 5574:2018 — Kết cấu bê tông và bê tông cốt thép (tham chiếu)',
});

export function exportProjectExcel(opts: {
  meta?: ProjectMeta;
  beams?: { beam: BeamInput; result: BeamResult }[];
  columns?: { col: ColumnInput; result: ColumnResult; asLabel?: string }[];
  slabs?: { slab: SlabInput; result: SlabResult }[];
  foundations?: { f: FoundationInput; result: FoundationResult }[];
}): void {
  const m = { ...defaultMeta(), ...opts.meta };
  const beams = opts.beams ?? [];
  const columns = opts.columns ?? [];
  const slabs = opts.slabs ?? [];
  const foundations = opts.foundations ?? [];
  const wb = XLSX.utils.book_new();

  const nPass =
    beams.filter((x) => x.result.pass).length +
    columns.filter((x) => x.result.pass).length +
    slabs.filter((x) => x.result.pass).length +
    foundations.filter((x) => x.result.pass).length;
  const nTotal = beams.length + columns.length + slabs.length + foundations.length;

  const info = [
    ['THUYẾT MINH TÍNH TOÁN BTCT — HỒ SƠ DỰ ÁN'],
    [],
    ['Dự án', m.projectName],
    ['Người thiết kế', m.designer],
    ['Ngày', m.date],
    ['Tiêu chuẩn tham chiếu', m.standard],
    [],
    ['Tổng cấu kiện', nTotal],
    ['Đạt', nPass],
    ['Chưa đạt', nTotal - nPass],
    ['Dầm', beams.length],
    ['Cột', columns.length],
    ['Sàn', slabs.length],
    ['Móng', foundations.length],
    [],
    ['Ghi chú', 'Công cụ hỗ trợ. Cột N–M gần đúng. Chưa chứng nhận full TCVN 5574:2018.'],
    ['Phần mềm', 'tinhketcaubtct2018 · BTCT 5574 V1.3'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(info), 'ThongTin');

  const tongHop: Record<string, unknown>[] = [];
  for (const { beam, result } of beams) {
    tongHop.push({ Loại: 'Dầm', Tên: beam.name, 'Kích thước': `${beam.b}×${beam.h}`, 'Kết luận': status(result.pass) });
  }
  for (const { col, result } of columns) {
    tongHop.push({ Loại: 'Cột', Tên: col.name, 'Kích thước': `${col.b}×${col.h}`, 'Kết luận': status(result.pass) });
  }
  for (const { slab, result } of slabs) {
    tongHop.push({ Loại: 'Sàn', Tên: slab.name, 'Kích thước': `h=${slab.h}`, 'Kết luận': status(result.pass) });
  }
  for (const { f, result } of foundations) {
    tongHop.push({ Loại: 'Móng', Tên: f.name, 'Kích thước': `${f.Lx}×${f.Ly}`, 'Kết luận': status(result.pass) });
  }
  if (tongHop.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tongHop), 'TongHop');

  if (beams.length) {
    const rows = beams.map(({ beam, result }) => ({
      Dầm: beam.name, 'b×h': `${beam.b}×${beam.h}`, L: beam.L ?? '',
      'M+': beam.MPositive, 'M-': beam.MNegative, Q: beam.Q,
      Uốn: status(result.negative.check.pass && result.positive.check.pass),
      Cắt: status(result.shear.check.pass), Nứt: status(result.crack.pass),
      Võng: (beam.L ?? 0) > 0 ? status(result.deflection.pass) : '—',
      KQ: status(result.pass),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Dam');
  }
  if (columns.length) {
    const rows = columns.map(({ col, result, asLabel }) => ({
      Cột: col.name, 'b×h': `${col.b}×${col.h}`, N: col.N, Mx: col.Mx, My: col.My,
      Thép: asLabel || col.bars || '', 'N-M': result.interaction.toFixed(3), vd: result.vd.toFixed(3),
      KQ: status(result.pass), 'Ghi chú': 'N-M gần đúng',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Cot');
  }
  if (slabs.length) {
    const rows = slabs.map(({ slab, result }) => ({
      Sàn: slab.name, h: slab.h, Lx: slab.Lx, Ly: slab.Ly,
      Uốn: status(result.flexureTop.pass && result.flexureBot.pass),
      Cắt: status(result.shear.pass), Nứt: status(result.crack.pass), KQ: status(result.pass),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'San');
  }
  if (foundations.length) {
    const rows = foundations.map(({ f, result }) => ({
      Móng: f.name, 'Lx×Ly': `${f.Lx}×${f.Ly}`,
      'ΣN': Math.round(result.sigmaN * 10) / 10,
      p_max: Math.round(result.pMax * 10) / 10,
      Rtc: Math.round(result.rtcUsed * 10) / 10,
      Nền: status(result.soilAvg.pass && result.soilMax.pass && result.soilMin.pass),
      'Chọc thủng': status(result.punching.pass), KQ: status(result.pass),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Mong');
  }

  const fname = `HoSo-BTCT-${(m.projectName || 'du-an').replace(/\s+/g, '_')}-${m.date}.xlsx`;
  XLSX.writeFile(wb, fname);
}

export function buildProjectReportHtml(opts: {
  meta: { projectName: string; designer: string; date: string; standard: string };
  sections: { title: string; rows: { name: string; size: string; pass: boolean; detail?: string }[] }[];
}): string {
  const { meta, sections } = opts;
  const total = sections.reduce((s, sec) => s + sec.rows.length, 0);
  const nPass = sections.reduce((s, sec) => s + sec.rows.filter((r) => r.pass).length, 0);
  const body = sections
    .map((sec) => {
      if (!sec.rows.length) return '';
      const tr = sec.rows
        .map(
          (r) =>
            `<tr><td>${r.name}</td><td>${r.size}</td><td>${r.detail || ''}</td><td class="${r.pass ? 'ok' : 'fail'}">${r.pass ? 'ĐẠT' : 'KHÔNG ĐẠT'}</td></tr>`
        )
        .join('');
      return `<h2>${sec.title}</h2><table><thead><tr><th>Tên</th><th>Kích thước</th><th>Ghi chú</th><th>KQ</th></tr></thead><tbody>${tr}</tbody></table>`;
    })
    .join('\n');
  return `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"/><title>Hồ sơ BTCT — ${meta.projectName}</title>
<style>
body{font-family:system-ui,sans-serif;max-width:960px;margin:24px auto;padding:0 16px;color:#111}
h1{font-size:1.4rem;margin:0 0 8px}h2{font-size:1.1rem;margin:24px 0 8px;border-bottom:1px solid #ddd;padding-bottom:4px}
table{width:100%;border-collapse:collapse;font-size:0.9rem;margin-bottom:12px}
th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}th{background:#f3f4f6}
.ok{color:#047857;font-weight:600}.fail{color:#b91c1c;font-weight:600}
.meta{display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;margin:12px 0 20px;font-size:0.9rem}
.note{background:#fffbeb;border:1px solid #fbbf24;padding:10px;border-radius:6px;font-size:0.85rem;margin:16px 0}
@media print{body{margin:0;max-width:none}}
</style></head><body>
<h1>THUYẾT MINH TÍNH TOÁN BTCT — HỒ SƠ DỰ ÁN</h1>
<div class="meta">
<div><b>Dự án:</b> ${meta.projectName}</div><div><b>Ngày:</b> ${meta.date}</div>
<div><b>Thiết kế:</b> ${meta.designer}</div><div><b>Tiêu chuẩn:</b> ${meta.standard}</div>
<div><b>Tổng CK:</b> ${total}</div><div><b>Đạt / KĐ:</b> ${nPass} / ${total - nPass}</div>
</div>
<div class="note">⚠ Cột: N–M <b>gần đúng</b> (không thay VBA Column.xlsm). Móng: đối chiếu MongDon.xlsm. Chưa full compliance TCVN 5574:2018.</div>
${body}
<p style="margin-top:32px;font-size:0.85rem;color:#666">In → Lưu PDF · tinhketcaubtct2018</p>
<script>window.onload=()=>{try{window.print()}catch(e){}}</script>
</body></html>`;
}

export function openProjectReportPdf(opts: Parameters<typeof buildProjectReportHtml>[0]): void {
  const html = buildProjectReportHtml(opts);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank');
  if (w) {
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return;
  }
  const a = document.createElement('a');
  a.href = url;
  a.download = `hoso-btct-${Date.now()}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  alert('Trình duyệt chặn cửa sổ mới — đã tải file HTML. Mở file rồi In → Lưu PDF.');
}
