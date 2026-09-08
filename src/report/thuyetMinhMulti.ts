/**
 * Thuyết minh PDF đa cấu kiện — Cột / Sàn / Móng.
 */
import type { ColumnInput, ColumnResult } from '../engine/column';
import type { SlabInput, SlabResult } from '../engine/slab';
import type { FoundationInput, FoundationResult } from '../engine/foundation';
import type { ReportDoc } from './reportPdf';
import type { ProjectMeta } from './excelReport';

const fmt = (v: number, d = 1) =>
  Number.isFinite(v) ? v.toLocaleString('vi-VN', { maximumFractionDigits: d }) : '—';

const defaultMeta = (meta?: ProjectMeta) => ({
  projectName: meta?.projectName || 'Dự án mẫu',
  designer: meta?.designer || 'KS. Thiết kế',
  date: meta?.date || new Date().toLocaleDateString('vi-VN'),
  standard: meta?.standard || 'TCVN 5574:2018',
});

export function columnThuyetMinhDoc(
  items: { col: ColumnInput; result: ColumnResult }[],
  meta?: ProjectMeta
): ReportDoc {
  const m = defaultMeta(meta);
  const passN = items.filter((x) => x.result.pass).length;
  return {
    meta: {
      title: 'THUYẾT MINH TÍNH TOÁN CỘT BÊ TÔNG CỐT THÉP',
      subtitle: `${m.projectName} · ${m.designer} · ${m.standard}`,
      itemName: `${items.length} cột · ${passN}/${items.length} ĐẠT`,
      version: '',
    },
    overallPass: items.length > 0 && passN === items.length,
    sections: [
      {
        heading: '0. Tổng quan',
        rows: [
          { label: 'Số cột', value: String(items.length) },
          { label: 'ĐẠT / Tổng', value: `${passN} / ${items.length}` },
          { label: 'Ghi chú', value: 'N–M gần đúng' },
        ],
      },
      {
        heading: '1. Bảng tổng hợp',
        rows: items.map(({ col, result: r }) => ({
          label: col.name,
          value: `${col.b}×${col.h} · N=${fmt(col.N, 0)} · μ=${fmt(r.mu, 3)}% · ${r.pass ? 'ĐẠT' : 'KĐ'}`,
        })),
      },
      ...items.flatMap(({ col, result: r }, i) => [
        {
          heading: `${i + 2}. ${col.name}`,
          rows: [
            { label: 'b × h / L0', value: `${col.b}×${col.h} mm · L0x/y=${col.L0x}/${col.L0y}` },
            { label: 'N / Mx / My', value: `${fmt(col.N)} / ${fmt(col.Mx)} / ${fmt(col.My)}` },
            { label: 'Thép', value: col.bars || '—' },
            { label: 'μ / λmax / vd / α', value: `${fmt(r.mu, 3)}% / ${fmt(r.lambdaMax, 1)} / ${fmt(r.vd, 3)} / ${fmt(r.interaction, 3)}` },
            { label: 'Kết luận', value: r.pass ? 'ĐẠT' : 'KHÔNG ĐẠT' },
          ],
          checks: [...Object.values(r.checks), r.shearX.check, r.shearY.check],
        },
      ]),
    ],
    footerNote: '',
    warnings: items.flatMap((x) => x.result.warnings).slice(0, 20),
  };
}

export function slabThuyetMinhDoc(
  items: { slab: SlabInput; result: SlabResult }[],
  meta?: ProjectMeta
): ReportDoc {
  const m = defaultMeta(meta);
  const passN = items.filter((x) => x.result.pass).length;
  return {
    meta: {
      title: 'THUYẾT MINH TÍNH TOÁN SÀN BÊ TÔNG CỐT THÉP',
      subtitle: `${m.projectName} · ${m.designer} · ${m.standard}`,
      itemName: `${items.length} sàn · ${passN}/${items.length} ĐẠT`,
      version: '',
    },
    overallPass: items.length > 0 && passN === items.length,
    sections: [
      {
        heading: '0. Tổng quan',
        rows: [
          { label: 'Số sàn', value: String(items.length) },
          { label: 'ĐẠT / Tổng', value: `${passN} / ${items.length}` },
        ],
      },
      {
        heading: '1. Bảng tổng hợp',
        rows: items.map(({ slab, result: r }) => ({
          label: slab.name,
          value: `h=${slab.h} · ${slab.Lx}×${slab.Ly} · ${r.pass ? 'ĐẠT' : 'KĐ'}`,
        })),
      },
      ...items.flatMap(({ slab, result: r }, i) => [
        {
          heading: `${i + 2}. ${slab.name}`,
          rows: [
            { label: 'h / Lx×Ly', value: `${slab.h} mm · ${slab.Lx}×${slab.Ly} m` },
            { label: 'Thép trên / dưới', value: `${slab.barsTop || '—'} / ${slab.barsBottom || '—'}` },
            { label: 'Kết luận', value: r.pass ? 'ĐẠT' : 'KHÔNG ĐẠT' },
          ],
          checks: [r.flexureTop, r.flexureBot, r.shear, r.crack, r.deflection],
        },
      ]),
    ],
    footerNote: '',
    warnings: items.flatMap((x) => x.result.warnings || []).slice(0, 20),
  };
}

export function foundationThuyetMinhDoc(
  items: { f: FoundationInput; result: FoundationResult }[],
  meta?: ProjectMeta
): ReportDoc {
  const m = defaultMeta(meta);
  const passN = items.filter((x) => x.result.pass).length;
  return {
    meta: {
      title: 'THUYẾT MINH TÍNH TOÁN MÓNG ĐƠN BÊ TÔNG CỐT THÉP',
      subtitle: `${m.projectName} · ${m.designer} · ${m.standard}`,
      itemName: `${items.length} móng · ${passN}/${items.length} ĐẠT`,
      version: '',
    },
    overallPass: items.length > 0 && passN === items.length,
    sections: [
      {
        heading: '0. Tổng quan',
        rows: [
          { label: 'Số móng', value: String(items.length) },
          { label: 'ĐẠT / Tổng', value: `${passN} / ${items.length}` },
        ],
      },
      {
        heading: '1. Bảng tổng hợp',
        rows: items.map(({ f, result: r }) => ({
          label: f.name,
          value: `${f.Lx}×${f.Ly}×${f.Hf} · N=${fmt(f.N, 0)} · pmax=${fmt(r.pMax, 0)} · ${r.pass ? 'ĐẠT' : 'KĐ'}`,
        })),
      },
      ...items.flatMap(({ f, result: r }, i) => [
        {
          heading: `${i + 2}. ${f.name}`,
          rows: [
            { label: 'Lx×Ly×Hf / cột', value: `${f.Lx}×${f.Ly}×${f.Hf} · cột ${f.colB}×${f.colH}` },
            { label: 'N / Mx / My / Rtc', value: `${fmt(f.N)} / ${fmt(f.Mx)} / ${fmt(f.My)} / ${fmt(f.Rtc)}` },
            { label: 'Af / Wx / Wy', value: `${fmt(r.Af, 3)} / ${fmt(r.Wx, 3)} / ${fmt(r.Wy, 3)}` },
            { label: 'p_tb / max / min', value: `${fmt(r.pAvg)} / ${fmt(r.pMax)} / ${fmt(r.pMin)}` },
            { label: 'Nct / Nkt', value: `${fmt(r.punching.Nct)} / ${fmt(r.punching.Nkt)}` },
            { label: 'Asx yc/bt', value: `${fmt(r.AsXReq, 0)} / ${fmt(r.AsXProv, 0)}` },
            { label: 'Asy yc/bt', value: `${fmt(r.AsYReq, 0)} / ${fmt(r.AsYProv, 0)}` },
            { label: 'Kết luận', value: r.pass ? 'ĐẠT' : 'KHÔNG ĐẠT' },
          ],
          checks: [r.soilAvg, r.soilMax, r.soilMin, r.punching, r.flexureX, r.flexureY],
        },
      ]),
    ],
    footerNote: '',
    warnings: items.flatMap((x) => x.result.warnings).slice(0, 20),
  };
}
