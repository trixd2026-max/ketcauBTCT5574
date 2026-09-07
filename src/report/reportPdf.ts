/**
 * Báo cáo PDF chuyên nghiệp — render HTML → print/save PDF (hỗ trợ tiếng Việt).
 * Không phụ thuộc font jsPDF; dùng cửa sổ in có stylesheet kỹ thuật.
 */

export type ReportMeta = {
  title: string;
  subtitle?: string;
  project?: string;
  itemName?: string;
  version?: string;
};

export type ReportSection = {
  heading: string;
  rows?: { label: string; value: string }[];
  checks?: { pass: boolean; message: string }[];
  note?: string;
  table?: { headers: string[]; rows: string[][] };
};

export type ReportDoc = {
  meta: ReportMeta;
  overallPass: boolean;
  sections: ReportSection[];
  warnings?: string[];
  footerNote?: string;
};

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildReportHtml(doc: ReportDoc): string {
  const now = new Date().toLocaleString('vi-VN');
  const statusClass = doc.overallPass ? 'pass' : 'fail';
  const statusText = doc.overallPass ? 'ĐẠT' : 'KHÔNG ĐẠT';

  const sectionsHtml = doc.sections
    .map((sec) => {
      let body = '';
      if (sec.rows?.length) {
        body += `<table class="kv"><tbody>${sec.rows
          .map(
            (r) =>
              `<tr><td class="k">${esc(r.label)}</td><td class="v">${esc(r.value)}</td></tr>`
          )
          .join('')}</tbody></table>`;
      }
      if (sec.table) {
        body += `<table class="data"><thead><tr>${sec.table.headers
          .map((h) => `<th>${esc(h)}</th>`)
          .join('')}</tr></thead><tbody>${sec.table.rows
          .map((row) => `<tr>${row.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`)
          .join('')}</tbody></table>`;
      }
      if (sec.checks?.length) {
        body += `<ul class="checks">${sec.checks
          .map(
            (c) =>
              `<li class="${c.pass ? 'ok' : 'bad'}">${c.pass ? '✓' : '×'} ${esc(c.message)}</li>`
          )
          .join('')}</ul>`;
      }
      if (sec.note) body += `<p class="note">${esc(sec.note)}</p>`;
      return `<section class="sec"><h2>${esc(sec.heading)}</h2>${body}</section>`;
    })
    .join('');

  const warningsHtml =
    doc.warnings && doc.warnings.length
      ? `<section class="sec warn"><h2>Cảnh báo / ghi chú</h2><ul>${doc.warnings
          .map((w) => `<li>${esc(w)}</li>`)
          .join('')}</ul></section>`
      : '';

  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8"/>
<title>${esc(doc.meta.title)} — ${esc(doc.meta.itemName || '')}</title>
<style>
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif;
    font-size: 11pt; color: #111; line-height: 1.45; margin: 0; padding: 0;
  }
  .sheet { max-width: 190mm; margin: 0 auto; padding: 12px 16px 24px; }
  header.report-head {
    border-bottom: 2.5px solid #0f3d6e;
    padding-bottom: 10px; margin-bottom: 14px;
    display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: end;
  }
  .brand { font-size: 11pt; color: #0f3d6e; font-weight: 700; letter-spacing: 0.02em; }
  .brand span { font-weight: 400; color: #456; }
  h1 { font-size: 16pt; margin: 4px 0 2px; color: #0a2a4a; }
  .sub { color: #555; font-size: 10pt; }
  .meta-right { text-align: right; font-size: 9.5pt; color: #444; }
  .badge {
    display: inline-block; padding: 4px 12px; border-radius: 4px;
    font-weight: 700; font-size: 12pt; letter-spacing: 0.04em;
  }
  .badge.pass { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
  .badge.fail { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
  .sec { margin: 12px 0 10px; page-break-inside: avoid; }
  .sec h2 {
    font-size: 11.5pt; margin: 0 0 6px; padding: 4px 8px;
    background: #e8eef5; color: #0f3d6e; border-left: 4px solid #0f3d6e;
  }
  table.kv { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
  table.kv td { padding: 3px 6px; vertical-align: top; border-bottom: 1px solid #e5e7eb; }
  table.kv td.k { width: 42%; color: #374151; }
  table.kv td.v { font-weight: 600; color: #111; }
  table.data { width: 100%; border-collapse: collapse; font-size: 10pt; margin-top: 4px; }
  table.data th, table.data td { border: 1px solid #cbd5e1; padding: 4px 6px; text-align: left; }
  table.data th { background: #f1f5f9; color: #0f3d6e; }
  ul.checks { list-style: none; padding: 0; margin: 4px 0; }
  ul.checks li { padding: 2px 0; }
  ul.checks li.ok { color: #166534; }
  ul.checks li.bad { color: #991b1b; font-weight: 600; }
  .note { font-size: 9.5pt; color: #555; margin: 4px 0; }
  .warn h2 { background: #fef3c7; border-left-color: #d97706; color: #92400e; }
  footer.report-foot {
    margin-top: 18px; padding-top: 8px; border-top: 1px solid #cbd5e1;
    font-size: 9pt; color: #666; display: flex; justify-content: space-between; gap: 12px;
  }
  .sign {
    margin-top: 28px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;
    text-align: center; font-size: 10pt; page-break-inside: avoid;
  }
  .sign .box { border-top: 1px solid #999; padding-top: 6px; margin-top: 48px; color: #444; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none !important; }
  }
  .toolbar {
    position: sticky; top: 0; background: #0f3d6e; color: #fff;
    padding: 10px 14px; display: flex; gap: 10px; align-items: center;
    justify-content: space-between; z-index: 10;
  }
  .toolbar button {
    background: #fff; color: #0f3d6e; border: none; padding: 8px 14px;
    border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 11pt;
  }
  .toolbar button.secondary { background: transparent; color: #fff; border: 1px solid #fff; }
</style>
</head>
<body>
  <div class="toolbar no-print">
    <div><b>Xem trước báo cáo</b> — chọn «In / Lưu PDF» rồi chọn máy in «Microsoft Print to PDF» hoặc «Save as PDF»</div>
    <div>
      <button type="button" onclick="window.print()">In / Lưu PDF</button>
      <button type="button" class="secondary" onclick="window.close()">Đóng</button>
    </div>
  </div>
  <div class="sheet">
    <header class="report-head">
      <div>
        <div class="brand">BTCT 5574 <span>${esc(doc.meta.version || 'V1.3')}</span></div>
        <h1>${esc(doc.meta.title)}</h1>
        <div class="sub">${esc(doc.meta.subtitle || '')}</div>
        <div class="sub">Hạng mục: <b>${esc(doc.meta.itemName || '—')}</b>
          ${doc.meta.project ? ` · Dự án: <b>${esc(doc.meta.project)}</b>` : ''}
        </div>
      </div>
      <div class="meta-right">
        <div>Ngày xuất: ${esc(now)}</div>
        <div style="margin-top:8px"><span class="badge ${statusClass}">${statusText}</span></div>
      </div>
    </header>

    ${sectionsHtml}
    ${warningsHtml}

    <div class="sign">
      <div><div class="box">Người lập</div></div>
      <div><div class="box">Người kiểm tra</div></div>
      <div><div class="box">Phê duyệt</div></div>
    </div>

    <footer class="report-foot">
      <span>${esc(doc.footerNote || 'Báo cáo tính toán BTCT — chưa khẳng định tuân thủ đầy đủ TCVN 5574:2018 cho đến khi golden cases được đối chiếu.')}</span>
      <span>tinhketcaubtct2018</span>
    </footer>
  </div>
</body>
</html>`;
}

/** Mở cửa sổ báo cáo chuyên nghiệp — người dùng In → Save as PDF */
export function openReportPdf(doc: ReportDoc): void {
  const html = buildReportHtml(doc);
  const w = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1000');
  if (!w) {
    alert('Trình duyệt chặn cửa sổ mới. Cho phép pop-up để xuất PDF.');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

/** Tải file HTML báo cáo (có thể mở và in PDF offline) */
export function downloadReportHtml(doc: ReportDoc, filename: string): void {
  const html = buildReportHtml(doc);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.html') ? filename : `${filename}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

const fmt = (v: number, d = 1) =>
  Number.isFinite(v) ? v.toLocaleString('vi-VN', { maximumFractionDigits: d }) : '—';

export function beamReportDoc(
  beam: {
    name: string;
    b: number;
    h: number;
    L?: number;
    concrete: string;
    steel: string;
    MNegative: number;
    MPositive: number;
    Q: number;
    barsTop?: string;
    barsBottom?: string;
    AsTop: number;
    AsBottom: number;
  },
  result: {
    pass: boolean;
    negative: { ho: number; alphaM: number; xi: number; xiR: number; AsRequired: number; AsProvided: number; check: { pass: boolean; message: string } };
    positive: { ho: number; alphaM: number; xi: number; xiR: number; AsRequired: number; AsProvided: number; check: { pass: boolean; message: string } };
    shear: {
      qDemand: number;
      qbt: number;
      qResistance: number;
      compressionCheck: { pass: boolean; message: string };
      resistanceCheck: { pass: boolean; message: string };
      spacingCheck: { pass: boolean; message: string };
      check: { pass: boolean; message: string };
    };
    detailing: { pass: boolean; checks: { pass: boolean; message: string }[] };
    crack: {
      pass: boolean;
      Mcrc: number;
      cracked: boolean;
      acrcShort: number | null;
      acrcLong: number | null;
      limitShort: number;
      limitLong: number;
      checkShort: { pass: boolean; message: string };
      checkLong: { pass: boolean; message: string };
    };
    deflection: {
      pass: boolean;
      deltaShort: number;
      deltaLong: number;
      limit: number;
      limitRatio: number;
      checkShort: { pass: boolean; message: string };
      checkLong: { pass: boolean; message: string };
    };
    warnings: string[];
  }
): ReportDoc {
  return {
    meta: {
      title: 'BÁO CÁO TÍNH TOÁN DẦM BTCT',
      subtitle: 'Uốn · Cắt · Cấu tạo · Nứt · Võng — theo engine V1.2 (đối chiếu Beam.xlsm)',
      itemName: beam.name,
      version: 'Dầm V1.2',
    },
    overallPass: result.pass,
    sections: [
      {
        heading: '1. Thông số đầu vào',
        rows: [
          { label: 'Tiết diện b × h', value: `${beam.b} × ${beam.h} mm` },
          { label: 'Nhịp L', value: beam.L ? `${beam.L} m` : '—' },
          { label: 'Bê tông / thép', value: `${beam.concrete} / ${beam.steel}` },
          { label: 'M− / M+ ULS', value: `${fmt(beam.MNegative)} / ${fmt(beam.MPositive)} kNm` },
          { label: 'Q', value: `${fmt(beam.Q)} kN` },
          { label: 'Thép trên / As', value: `${beam.barsTop || '—'} · ${fmt(beam.AsTop, 0)} mm²` },
          { label: 'Thép dưới / As', value: `${beam.barsBottom || '—'} · ${fmt(beam.AsBottom, 0)} mm²` },
        ],
      },
      {
        heading: '2. Kiểm tra uốn M−',
        rows: [
          { label: 'ho', value: `${fmt(result.negative.ho)} mm` },
          { label: 'αm / ξ / ξR', value: `${fmt(result.negative.alphaM, 3)} / ${fmt(result.negative.xi, 3)} / ${fmt(result.negative.xiR, 3)}` },
          { label: 'As yêu cầu / bố trí', value: `${fmt(result.negative.AsRequired, 0)} / ${fmt(result.negative.AsProvided, 0)} mm²` },
        ],
        checks: [result.negative.check],
      },
      {
        heading: '3. Kiểm tra uốn M+',
        rows: [
          { label: 'ho', value: `${fmt(result.positive.ho)} mm` },
          { label: 'αm / ξ / ξR', value: `${fmt(result.positive.alphaM, 3)} / ${fmt(result.positive.xi, 3)} / ${fmt(result.positive.xiR, 3)}` },
          { label: 'As yêu cầu / bố trí', value: `${fmt(result.positive.AsRequired, 0)} / ${fmt(result.positive.AsProvided, 0)} mm²` },
        ],
        checks: [result.positive.check],
      },
      {
        heading: '4. Kiểm tra cắt',
        rows: [
          { label: 'Q / Qbt', value: `${fmt(result.shear.qDemand)} / ${fmt(result.shear.qbt)} kN` },
          { label: 'Qb + Qsw', value: `${fmt(result.shear.qResistance)} kN` },
        ],
        checks: [result.shear.compressionCheck, result.shear.resistanceCheck, result.shear.spacingCheck],
      },
      {
        heading: '5. Cấu tạo',
        checks: result.detailing.checks,
      },
      {
        heading: '6. Nứt (SLS)',
        rows: [
          { label: 'Mcrc', value: `${fmt(result.crack.Mcrc)} kNm` },
          { label: 'Trạng thái', value: result.crack.cracked ? 'Có nứt' : 'Không nứt' },
          {
            label: 'acrc ngắn / giới hạn',
            value:
              result.crack.acrcShort != null
                ? `${fmt(result.crack.acrcShort, 3)} / ${result.crack.limitShort} mm`
                : '—',
          },
          {
            label: 'acrc dài / giới hạn',
            value:
              result.crack.acrcLong != null
                ? `${fmt(result.crack.acrcLong, 3)} / ${result.crack.limitLong} mm`
                : '—',
          },
        ],
        checks: [result.crack.checkShort, result.crack.checkLong],
      },
      {
        heading: '7. Võng (ước lượng)',
        rows: beam.L
          ? [
              { label: 'δ ngắn / giới hạn', value: `${fmt(result.deflection.deltaShort)} / ${fmt(result.deflection.limit)} mm` },
              { label: 'δ dài / giới hạn', value: `${fmt(result.deflection.deltaLong)} / ${fmt(result.deflection.limit)} mm` },
              { label: 'L/δ', value: `L/${result.deflection.limitRatio}` },
            ]
          : [{ label: 'Ghi chú', value: 'Chưa nhập nhịp L — không kiểm tra võng' }],
        checks: beam.L ? [result.deflection.checkShort, result.deflection.checkLong] : undefined,
      },
      {
        heading: '8. Kết luận',
        rows: [{ label: 'Kết luận tổng hợp', value: result.pass ? 'ĐẠT' : 'KHÔNG ĐẠT' }],
      },
    ],
    warnings: result.warnings?.slice(0, 15),
  };
}

export function columnReportDoc(
  col: {
    name: string;
    b: number;
    h: number;
    L0x: number;
    L0y: number;
    N: number;
    Mx: number;
    My: number;
    concrete: string;
    steel: string;
    bars?: string;
  },
  result: {
    pass: boolean;
    mu: number;
    lambdaMax: number;
    vd: number;
    interaction: number;
    checks: Record<string, { pass: boolean; message: string }>;
    shearX: { check: { pass: boolean; message: string } };
    shearY: { check: { pass: boolean; message: string } };
    warnings: string[];
  }
): ReportDoc {
  return {
    meta: {
      title: 'BÁO CÁO TÍNH TOÁN CỘT BTCT',
      subtitle: 'Độ mảnh · N–M (gần đúng) · Đai — Column V1.1',
      itemName: col.name,
      version: 'Cột V1.1',
    },
    overallPass: result.pass,
    sections: [
      {
        heading: '1. Thông số đầu vào',
        rows: [
          { label: 'Tiết diện b × h', value: `${col.b} × ${col.h} mm` },
          { label: 'L0x / L0y', value: `${col.L0x} / ${col.L0y} mm` },
          { label: 'N / Mx / My', value: `${fmt(col.N)} kN / ${fmt(col.Mx)} / ${fmt(col.My)} kNm` },
          { label: 'Bê tông / thép', value: `${col.concrete} / ${col.steel}` },
          { label: 'Cốt thép dọc', value: col.bars || '—' },
        ],
      },
      {
        heading: '2. Kết quả kiểm tra',
        rows: [
          { label: 'μ / λmax / vd', value: `${fmt(result.mu, 3)}% / ${fmt(result.lambdaMax, 1)} / ${fmt(result.vd, 3)}` },
          { label: 'Hệ số N–M α (gần đúng)', value: fmt(result.interaction, 3) },
        ],
        checks: [...Object.values(result.checks), result.shearX.check, result.shearY.check],
      },
      {
        heading: '3. Kết luận',
        rows: [{ label: 'Kết luận tổng hợp', value: result.pass ? 'ĐẠT' : 'KHÔNG ĐẠT' }],
        note: 'Biểu đồ tương tác N–M là gần đúng — không thay thế macro VBA trong Column.xlsm.',
      },
    ],
    warnings: result.warnings?.slice(0, 12),
  };
}

export function slabReportDoc(
  slab: {
    name: string;
    h: number;
    Lx: number;
    Ly: number;
    Mtop: number;
    Mbot: number;
    Q: number;
    concrete: string;
    steel: string;
    barsTop?: string;
    barsBottom?: string;
  },
  result: {
    pass: boolean;
    AsTopReq: number;
    AsTopProv: number;
    AsBotReq: number;
    AsBotProv: number;
    flexureTop: { pass: boolean; message: string };
    flexureBot: { pass: boolean; message: string };
    shear: { pass: boolean; message: string };
    crack: { pass: boolean; message: string };
    deflection: { pass: boolean; message: string };
    warnings?: string[];
  }
): ReportDoc {
  return {
    meta: {
      title: 'BÁO CÁO TÍNH TOÁN SÀN BTCT',
      subtitle: 'Strip 1 m · Uốn · Cắt · Nứt · Võng — Sàn V1.1',
      itemName: slab.name,
      version: 'Sàn V1.1',
    },
    overallPass: result.pass,
    sections: [
      {
        heading: '1. Thông số đầu vào',
        rows: [
          { label: 'Chiều dày h', value: `${slab.h} mm` },
          { label: 'Lx × Ly', value: `${slab.Lx} × ${slab.Ly} m` },
          { label: 'M− / M+ / Q', value: `${fmt(slab.Mtop)} / ${fmt(slab.Mbot)} kNm/m · ${fmt(slab.Q)} kN/m` },
          { label: 'Bê tông / thép', value: `${slab.concrete} / ${slab.steel}` },
          { label: 'Thép trên / dưới', value: `${slab.barsTop || '—'} / ${slab.barsBottom || '—'}` },
        ],
      },
      {
        heading: '2. Kết quả',
        rows: [
          { label: 'As− yc / bố trí', value: `${fmt(result.AsTopReq, 0)} / ${fmt(result.AsTopProv, 0)} mm²/m` },
          { label: 'As+ yc / bố trí', value: `${fmt(result.AsBotReq, 0)} / ${fmt(result.AsBotProv, 0)} mm²/m` },
        ],
        checks: [result.flexureTop, result.flexureBot, result.shear, result.crack, result.deflection],
      },
      {
        heading: '3. Kết luận',
        rows: [{ label: 'Kết luận tổng hợp', value: result.pass ? 'ĐẠT' : 'KHÔNG ĐẠT' }],
      },
    ],
    warnings: result.warnings?.slice(0, 10),
  };
}

export function foundationReportDoc(
  f: {
    name: string;
    Lx: number;
    Ly: number;
    Hf: number;
    N: number;
    Mx: number;
    My: number;
    Rtc: number;
    concrete: string;
    steel: string;
    barsX?: string;
    barsY?: string;
  },
  result: {
    pass: boolean;
    pAvg: number;
    pMax: number;
    pMin: number;
    soilAvg: { pass: boolean; message: string };
    soilMax: { pass: boolean; message: string };
    soilMin: { pass: boolean; message: string };
    punching: { pass: boolean; message: string; Nct: number; Nkt: number };
    flexureX: { pass: boolean; message: string };
    flexureY: { pass: boolean; message: string };
    AsXReq: number;
    AsXProv: number;
    AsYReq: number;
    AsYProv: number;
    warnings?: string[];
  }
): ReportDoc {
  return {
    meta: {
      title: 'BÁO CÁO TÍNH TOÁN MÓNG ĐƠN BTCT',
      subtitle: 'Áp lực nền · Chọc thủng · Uốn console — Móng V1.0',
      itemName: f.name,
      version: 'Móng V1.0',
    },
    overallPass: result.pass,
    sections: [
      {
        heading: '1. Thông số đầu vào',
        rows: [
          { label: 'Lx × Ly × Hf', value: `${f.Lx} × ${f.Ly} × ${f.Hf} m` },
          { label: 'N / Mx / My', value: `${fmt(f.N)} kN / ${fmt(f.Mx)} / ${fmt(f.My)} kNm` },
          { label: 'Rtc', value: `${fmt(f.Rtc)} kN/m²` },
          { label: 'Bê tông / thép', value: `${f.concrete} / ${f.steel}` },
          { label: 'Thép X / Y', value: `${f.barsX || '—'} / ${f.barsY || '—'}` },
        ],
      },
      {
        heading: '2. Áp lực nền & chọc thủng',
        rows: [
          { label: 'p_tb / p_max / p_min', value: `${fmt(result.pAvg)} / ${fmt(result.pMax)} / ${fmt(result.pMin)} kN/m²` },
          { label: 'Nct / Nkt', value: `${fmt(result.punching.Nct)} / ${fmt(result.punching.Nkt)} kN` },
        ],
        checks: [result.soilAvg, result.soilMax, result.soilMin, result.punching],
      },
      {
        heading: '3. Cốt thép đáy',
        rows: [
          { label: 'Asx yc / bố trí', value: `${fmt(result.AsXReq, 0)} / ${fmt(result.AsXProv, 0)} mm²/m` },
          { label: 'Asy yc / bố trí', value: `${fmt(result.AsYReq, 0)} / ${fmt(result.AsYProv, 0)} mm²/m` },
        ],
        checks: [result.flexureX, result.flexureY],
      },
      {
        heading: '4. Kết luận',
        rows: [{ label: 'Kết luận tổng hợp', value: result.pass ? 'ĐẠT' : 'KHÔNG ĐẠT' }],
      },
    ],
    warnings: result.warnings?.slice(0, 10),
  };
}
