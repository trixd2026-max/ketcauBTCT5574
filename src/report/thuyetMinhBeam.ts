/**
 * Thuyết minh đa dầm — theo mẫu PDF tải lên.
 */
import { getConcrete, getSteel } from '../engine/materials';
import type { BeamInput, BeamResult } from '../engine/beam';
import type { ReportDoc, ReportSection } from './reportPdf';

const fmt = (v: number, d = 1) =>
  Number.isFinite(v) ? v.toLocaleString('vi-VN', { maximumFractionDigits: d }) : '—';

function barTxt(spec: string | undefined, as: number, n?: number, dia?: number): string {
  if (spec && spec.trim()) return spec.trim().replace(/d/gi, 'Ø');
  if (n && dia) return `${n}Ø${dia}`;
  return as ? `${Math.round(as)} mm²` : '—';
}
function daiTxt(legs: number, dia: number, spacing: number): string {
  if (!dia || !spacing) return '—';
  return `Ø${dia}a${spacing}`;
}

export type ThuyetMinhMeta = {
  projectName?: string;
  designer?: string;
  standard?: string;
};

export function beamThuyetMinhDoc(
  items: { beam: BeamInput; result: BeamResult }[],
  meta?: ThuyetMinhMeta
): ReportDoc {
  const project = meta?.projectName || 'Dự án mẫu';
  const designer = meta?.designer || 'KS. Thiết kế';
  const standard = meta?.standard || 'TCVN 5574:2018 — Kết cấu bê tông và bê tông cốt thép';
  const nPass = items.filter((x) => x.result.pass).length;
  const nFail = items.length - nPass;

  const summaryTable = {
    headers: ['Dầm', 'b×h', 'M+ / M− (kNm)', 'Q (kN)', 'Thép dưới', 'Thép trên', 'Đai', 'Kết luận'],
    rows: items.map(({ beam, result }) => [
      beam.name,
      `${beam.b}×${beam.h}`,
      `${fmt(beam.MPositive)} / ${fmt(beam.MNegative)}`,
      fmt(beam.Q),
      barTxt(beam.barsBottom, beam.AsBottom, beam.nBarsBottom, beam.barDiaBottom),
      barTxt(beam.barsTop, beam.AsTop, beam.nBarsTop, beam.barDiaTop),
      daiTxt(beam.stirrupLegs, beam.stirrupDia, beam.stirrupSpacing),
      result.pass ? 'ĐẠT' : 'KHÔNG ĐẠT',
    ]),
  };

  const sections: ReportSection[] = [
    {
      heading: '1. Tổng quan',
      rows: [
        { label: 'Dự án', value: project },
        { label: 'Người thiết kế', value: designer },
        { label: 'Tiêu chuẩn tham chiếu', value: standard },
        { label: 'Số dầm tính toán', value: String(items.length) },
        { label: 'Số dầm đạt yêu cầu', value: String(nPass) },
        { label: 'Số dầm chưa đạt', value: String(nFail) },
      ],
    },
    {
      heading: '2. Bảng tổng hợp kết quả',
      table: summaryTable,
    },
  ];

  items.forEach(({ beam, result }, idx) => {
    const c = getConcrete(beam.concrete);
    const s = getSteel(beam.steel);
    const sw = getSteel(beam.stirrupSteel);
    const pos = result.positive;
    const neg = result.negative;
    const sh = result.shear;
    sections.push({
      heading: `3.${idx + 1}. Dầm ${beam.name}`,
      rows: [
        {
          label: 'Tiết diện & vật liệu',
          value: `b×h = ${beam.b}×${beam.h} mm, L = ${beam.L ?? '—'} m, a = ${beam.aTop}/${beam.aBottom} mm. ${beam.concrete} (Rb=${c.Rb}, Rbt=${c.Rbt} MPa), ${beam.steel} (Rs=${s.Rs}), đai ${beam.stirrupSteel} (Rsw=${sw.Rsw}).`,
        },
        {
          label: 'Uốn M+ (dưới)',
          value: `h₀=${fmt(pos.ho, 0)} mm; αm=${fmt(pos.alphaM, 3)}; ξ=${fmt(pos.xi, 3)}; ξR=${fmt(pos.xiR, 3)}; As=${fmt(pos.AsRequired, 0)} → ${barTxt(beam.barsBottom, beam.AsBottom, beam.nBarsBottom, beam.barDiaBottom)} = ${fmt(pos.AsProvided, 0)} mm²; μ=${fmt(pos.mu, 2)}%.`,
        },
        {
          label: 'Uốn M− (trên)',
          value: `h₀=${fmt(neg.ho, 0)} mm; αm=${fmt(neg.alphaM, 3)}; ξ=${fmt(neg.xi, 3)}; As=${fmt(neg.AsRequired, 0)} → ${barTxt(beam.barsTop, beam.AsTop, beam.nBarsTop, beam.barDiaTop)} = ${fmt(neg.AsProvided, 0)} mm²; μ=${fmt(neg.mu, 2)}%.`,
        },
        {
          label: 'Cắt',
          value: `Q=${fmt(sh.qDemand)} kN; Qbt=${fmt(sh.qbt)}; Qb+Qsw=${fmt(sh.qResistance)}; đai ${daiTxt(beam.stirrupLegs, beam.stirrupDia, beam.stirrupSpacing)} (s,max=${fmt(sh.sMax, 0)} mm).`,
        },
        {
          label: 'Nứt / Võng',
          value:
            (beam.L ?? 0) > 0
              ? `Mcrc=${fmt(result.crack.Mcrc)} kNm; acrc ngắn/dài=${result.crack.acrcShort != null ? fmt(result.crack.acrcShort, 3) : '—'}/${result.crack.acrcLong != null ? fmt(result.crack.acrcLong, 3) : '—'} mm; δ dài=${fmt(result.deflection.deltaLong)} ≤ [${fmt(result.deflection.limit)}] mm.`
              : `Mcrc=${fmt(result.crack.Mcrc)} kNm; chưa nhập L — không kiểm võng.`,
        },
      ],
      checks: [
        pos.check,
        neg.check,
        sh.check,
        { pass: result.detailing.pass, message: result.detailing.pass ? 'Cấu tạo đạt' : 'Cấu tạo chưa đạt' },
        { pass: result.crack.pass, message: result.crack.pass ? 'Nứt đạt' : 'Nứt chưa đạt' },
        ...((beam.L ?? 0) > 0
          ? [{ pass: result.deflection.pass, message: result.deflection.pass ? 'Võng đạt' : 'Võng chưa đạt' }]
          : []),
        { pass: result.pass, message: result.pass ? `Kết luận: ${beam.name} — ĐẠT` : `Kết luận: ${beam.name} — KHÔNG ĐẠT` },
      ],
    });
  });

  return {
    meta: {
      title: 'THUYẾT MINH TÍNH TOÁN DẦM BÊ TÔNG CỐT THÉP',
      subtitle: `${project} · ${designer}`,
      itemName: `${items.length} dầm`,
      version: 'Dầm V1.2',
      project,
    },
    overallPass: nFail === 0 && items.length > 0,
    sections,
    footerNote:
      'Đây là công cụ hỗ trợ thiết kế. Mọi kết quả phải được kỹ sư kiểm tra và chịu trách nhiệm theo tiêu chuẩn áp dụng trước khi đưa vào hồ sơ thi công. Chưa khẳng định tuân thủ đầy đủ TCVN 5574:2018 cho đến khi golden cases được đối chiếu.',
    warnings: items.flatMap((x) => x.result.warnings).slice(0, 20),
  };
}
