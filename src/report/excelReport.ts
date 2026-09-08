/**
 * Xuất báo cáo Excel chuẩn — nhiều sheet theo mẫu thuyết minh.
 * Dùng chung: Dầm / Cột / Sàn / Móng.
 */
import * as XLSX from 'xlsx';
import type { BeamInput, BeamResult } from '../engine/beam';
import { getConcrete, getSteel } from '../engine/materials';

export type ProjectMeta = {
  projectName?: string;
  designer?: string;
  date?: string;
  standard?: string;
};

const defaultMeta = (): Required<ProjectMeta> => ({
  projectName: 'Dự án mẫu',
  designer: 'KS. Thiết kế',
  date: new Date().toLocaleDateString('vi-VN'),
  standard: 'TCVN 5574:2018 — Kết cấu bê tông và bê tông cốt thép',
});

const fmt = (v: number, d = 1) =>
  Number.isFinite(v) ? Number(v.toFixed(d)) : '';

const status = (ok: boolean) => (ok ? 'ĐẠT' : 'KHÔNG ĐẠT');

function barLabel(spec: string | undefined, as: number, n?: number, dia?: number): string {
  if (spec && spec.trim()) return spec.trim().replace(/d/gi, 'Ø');
  if (n && dia) return `${n}Ø${dia}`;
  return as ? `${Math.round(as)} mm²` : '—';
}

function stirrupLabel(legs: number, dia: number, spacing: number): string {
  if (!dia || !spacing) return '—';
  return `Ø${dia}${legs > 2 ? `-${legs}nh` : ''}a${spacing}`;
}

/** ---- DẦM ---- */
export function exportBeamExcel(
  items: { beam: BeamInput; result: BeamResult }[],
  meta?: ProjectMeta
): void {
  const m = { ...defaultMeta(), ...meta };
  const wb = XLSX.utils.book_new();

  const info = [
    ['THUYẾT MINH TÍNH TOÁN DẦM BÊ TÔNG CỐT THÉP'],
    [],
    ['Dự án', m.projectName],
    ['Người thiết kế', m.designer],
    ['Ngày', m.date],
    ['Tiêu chuẩn tham chiếu', m.standard],
    [],
    ['Số dầm tính toán', items.length],
    ['Số dầm đạt', items.filter((x) => x.result.pass).length],
    ['Số dầm chưa đạt', items.filter((x) => !x.result.pass).length],
    [],
    ['Ghi chú', 'Công cụ hỗ trợ thiết kế. Kết quả cần KS kiểm tra trước khi đưa vào hồ sơ thi công.'],
    ['Phần mềm', 'tinhketcaubtct2018 · BTCT 5574 V1.3'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(info), 'ThongTin');

  const summaryRows = items.map(({ beam, result }) => ({
    Dầm: beam.name,
    'b×h (mm)': `${beam.b}×${beam.h}`,
    'L (m)': beam.L ?? '',
    'M+ (kNm)': fmt(beam.MPositive, 1),
    'M− (kNm)': fmt(beam.MNegative, 1),
    'Q (kN)': fmt(beam.Q, 1),
    'Thép dưới': barLabel(beam.barsBottom, beam.AsBottom, beam.nBarsBottom, beam.barDiaBottom),
    'Thép trên': barLabel(beam.barsTop, beam.AsTop, beam.nBarsTop, beam.barDiaTop),
    Đai: stirrupLabel(beam.stirrupLegs, beam.stirrupDia, beam.stirrupSpacing),
    Uốn: status(result.negative.check.pass && result.positive.check.pass),
    Cắt: status(result.shear.check.pass),
    'Cấu tạo': status(result.detailing.pass),
    Nứt: status(result.crack.pass),
    Võng: (beam.L ?? 0) > 0 ? status(result.deflection.pass) : '—',
    'Kết luận': status(result.pass),
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'TongHop');

  const inputRows = items.map(({ beam }) => ({
    Dầm: beam.name,
    b: beam.b,
    h: beam.h,
    'L (m)': beam.L ?? '',
    'a trên': beam.aTop,
    'a dưới': beam.aBottom,
    'M− ULS': beam.MNegative,
    'M+ ULS': beam.MPositive,
    Q: beam.Q,
    'Bê tông': beam.concrete,
    'Thép dọc': beam.steel,
    'Thép đai': beam.stirrupSteel,
    'Thép trên': beam.barsTop ?? '',
    'As trên': beam.AsTop,
    'Thép dưới': beam.barsBottom ?? '',
    'As dưới': beam.AsBottom,
    'Nhánh đai': beam.stirrupLegs,
    'Ø đai': beam.stirrupDia,
    's đai': beam.stirrupSpacing,
    'Mser− ngắn': beam.MserShortNeg ?? '',
    'Mser+ ngắn': beam.MserShortPos ?? '',
    'Mser− dài': beam.MserLongNeg ?? '',
    'Mser+ dài': beam.MserLongPos ?? '',
    'Độ ẩm': beam.humidity ?? 'mid',
    'Gối tựa': beam.support ?? 'simple',
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(inputRows), 'DauVao');

  const calcRows = items.map(({ beam, result }) => {
    const c = getConcrete(beam.concrete);
    const s = getSteel(beam.steel);
    const sw = getSteel(beam.stirrupSteel);
    return {
      Dầm: beam.name,
      'Rb (MPa)': c.Rb,
      'Rbt (MPa)': c.Rbt,
      'Rs (MPa)': s.Rs,
      'Rsw (MPa)': sw.Rsw,
      'ho− (mm)': fmt(result.negative.ho, 1),
      'αm−': fmt(result.negative.alphaM, 3),
      'ξ−': fmt(result.negative.xi, 3),
      'ξR−': fmt(result.negative.xiR, 3),
      'As− yc': fmt(result.negative.AsRequired, 0),
      'As− bố trí': fmt(result.negative.AsProvided, 0),
      'μ− (%)': fmt(result.negative.mu, 2),
      'ho+ (mm)': fmt(result.positive.ho, 1),
      'αm+': fmt(result.positive.alphaM, 3),
      'ξ+': fmt(result.positive.xi, 3),
      'ξR+': fmt(result.positive.xiR, 3),
      'As+ yc': fmt(result.positive.AsRequired, 0),
      'As+ bố trí': fmt(result.positive.AsProvided, 0),
      'μ+ (%)': fmt(result.positive.mu, 2),
      'Q (kN)': fmt(result.shear.qDemand, 1),
      'Qbt (kN)': fmt(result.shear.qbt, 1),
      'Qb (kN)': fmt(result.shear.qB, 1),
      'Qsw (kN)': fmt(result.shear.qSw, 1),
      'Qb+Qsw': fmt(result.shear.qResistance, 1),
      's,max (mm)': fmt(result.shear.sMax, 0),
      'Mcrc (kNm)': fmt(result.crack.Mcrc, 1),
      'acrc ngắn': result.crack.acrcShort != null ? fmt(result.crack.acrcShort, 3) : '',
      'acrc dài': result.crack.acrcLong != null ? fmt(result.crack.acrcLong, 3) : '',
      'δ ngắn (mm)': (beam.L ?? 0) > 0 ? fmt(result.deflection.deltaShort, 1) : '',
      'δ dài (mm)': (beam.L ?? 0) > 0 ? fmt(result.deflection.deltaLong, 1) : '',
      '[δ] (mm)': (beam.L ?? 0) > 0 ? fmt(result.deflection.limit, 1) : '',
    };
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(calcRows), 'TinhToan');

  const checkRows = items.map(({ beam, result }) => ({
    Dầm: beam.name,
    'Uốn M−': status(result.negative.check.pass),
    'Ghi chú M−': result.negative.check.message,
    'Uốn M+': status(result.positive.check.pass),
    'Ghi chú M+': result.positive.check.message,
    'Cắt nén': status(result.shear.compressionCheck.pass),
    'Cắt kháng': status(result.shear.resistanceCheck.pass),
    'Cắt bước đai': status(result.shear.spacingCheck.pass),
    'Cấu tạo': status(result.detailing.pass),
    'Nứt ngắn': status(result.crack.checkShort.pass),
    'Nứt dài': status(result.crack.checkLong.pass),
    'Võng ngắn': (beam.L ?? 0) > 0 ? status(result.deflection.checkShort.pass) : '—',
    'Võng dài': (beam.L ?? 0) > 0 ? status(result.deflection.checkLong.pass) : '—',
    'Kết luận': status(result.pass),
    'Cảnh báo': result.warnings.slice(0, 5).join(' | '),
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(checkRows), 'KiemTra');

  const rebarRows = items.map(({ beam, result }) => ({
    Dầm: beam.name,
    'Thép trên': barLabel(beam.barsTop, beam.AsTop, beam.nBarsTop, beam.barDiaTop),
    'As trên bố trí': fmt(result.negative.AsProvided, 0),
    'As trên yêu cầu': fmt(result.negative.AsRequired, 0),
    'μ trên (%)': fmt(result.negative.mu, 2),
    'Thép dưới': barLabel(beam.barsBottom, beam.AsBottom, beam.nBarsBottom, beam.barDiaBottom),
    'As dưới bố trí': fmt(result.positive.AsProvided, 0),
    'As dưới yêu cầu': fmt(result.positive.AsRequired, 0),
    'μ dưới (%)': fmt(result.positive.mu, 2),
    Đai: stirrupLabel(beam.stirrupLegs, beam.stirrupDia, beam.stirrupSpacing),
    'Asw (mm²)': fmt(result.shear.stirrupArea, 1),
    's,max (mm)': fmt(result.shear.sMax, 0),
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rebarRows), 'Thep');

  const detailRows: { STT: number; Dầm: string; Nội_dung: string }[] = [];
  items.forEach(({ beam, result }, i) => {
    const c = getConcrete(beam.concrete);
    const s = getSteel(beam.steel);
    const sw = getSteel(beam.stirrupSteel);
    const lines = [
      `Tiết diện b×h = ${beam.b}×${beam.h} mm, nhịp L = ${beam.L ?? '—'} m, lớp bảo vệ a trên/dưới = ${beam.aTop}/${beam.aBottom} mm.`,
      `Bê tông ${beam.concrete} (Rb = ${c.Rb} MPa, Rbt = ${c.Rbt} MPa), thép dọc ${beam.steel} (Rs = ${s.Rs} MPa), thép đai ${beam.stirrupSteel} (Rsw = ${sw.Rsw} MPa).`,
      `Cốt thép chịu momen dương (M+): h₀ = ${fmt(result.positive.ho, 0)} mm; αm = ${fmt(result.positive.alphaM, 3)}; ξ = ${fmt(result.positive.xi, 3)}; ξR = ${fmt(result.positive.xiR, 3)}; As = ${fmt(result.positive.AsRequired, 0)} mm² → bố trí ${barLabel(beam.barsBottom, beam.AsBottom, beam.nBarsBottom, beam.barDiaBottom)} = ${fmt(result.positive.AsProvided, 0)} mm², μ = ${fmt(result.positive.mu, 2)}%.`,
      `Cốt thép chịu momen âm (M−): h₀ = ${fmt(result.negative.ho, 0)} mm; αm = ${fmt(result.negative.alphaM, 3)}; ξ = ${fmt(result.negative.xi, 3)}; As = ${fmt(result.negative.AsRequired, 0)} mm² → bố trí ${barLabel(beam.barsTop, beam.AsTop, beam.nBarsTop, beam.barDiaTop)} = ${fmt(result.negative.AsProvided, 0)} mm², μ = ${fmt(result.negative.mu, 2)}%.`,
      `Kiểm tra cắt: Q = ${fmt(result.shear.qDemand, 1)} kN; Qbt = ${fmt(result.shear.qbt, 1)} kN; Qb+Qsw = ${fmt(result.shear.qResistance, 1)} kN; đai ${stirrupLabel(beam.stirrupLegs, beam.stirrupDia, beam.stirrupSpacing)} (s,max = ${fmt(result.shear.sMax, 0)} mm).`,
      (beam.L ?? 0) > 0
        ? `Kiểm tra võng: δ dài = ${fmt(result.deflection.deltaLong, 1)} mm ≤ [δ] = ${fmt(result.deflection.limit, 1)} mm.`
        : `Kiểm tra võng: chưa nhập nhịp L.`,
      `Nứt: Mcrc = ${fmt(result.crack.Mcrc, 1)} kNm; acrc ngắn/dài = ${result.crack.acrcShort != null ? fmt(result.crack.acrcShort, 3) : '—'}/${result.crack.acrcLong != null ? fmt(result.crack.acrcLong, 3) : '—'} mm.`,
      `Kết luận: dầm ${beam.name} — ${status(result.pass)} yêu cầu.`,
    ];
    lines.forEach((line) => detailRows.push({ STT: i + 1, Dầm: beam.name, Nội_dung: line }));
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailRows), 'ChiTiet');

  const fname = `ThuyetMinh-Dam-BTCT-${m.date.replace(/\//g, '-')}.xlsx`;
  XLSX.writeFile(wb, fname);
}

/** ---- Generic multi-sheet helper for other modules ---- */
export function exportGenericExcel(
  moduleTitle: string,
  filePrefix: string,
  sheets: { name: string; rows: Record<string, unknown>[] }[],
  meta?: ProjectMeta
): void {
  const m = { ...defaultMeta(), ...meta };
  const wb = XLSX.utils.book_new();
  const info = [
    [moduleTitle],
    [],
    ['Dự án', m.projectName],
    ['Người thiết kế', m.designer],
    ['Ngày', m.date],
    ['Tiêu chuẩn', m.standard],
    [],
    ['Phần mềm', 'tinhketcaubtct2018 · BTCT 5574 V1.3'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(info), 'ThongTin');
  for (const sh of sheets) {
    if (!sh.rows.length) continue;
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sh.rows), sh.name.slice(0, 31));
  }
  XLSX.writeFile(wb, `${filePrefix}-${m.date.replace(/\//g, '-')}.xlsx`);
}
