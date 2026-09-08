/**
 * Golden cột — regression + cảnh báo N–M gần đúng.
 * N–M interaction KHÔNG phải VBA Column.xlsm; chỉ dùng cho kiểm tra định hướng.
 */
import type { ColumnInput } from './column';
import { calcColumn, createDefaultColumn } from './column';

export type ColumnGolden = {
  id: string;
  note: string;
  input: ColumnInput;
  expect: {
    muMin?: number;
    muMax?: number;
    vdLimit?: number;
    interactionMax?: number;
    pass?: boolean;
    muPass?: boolean;
    mustWarnNM?: boolean;
  };
};

const base = (p: Partial<ColumnInput>): ColumnInput => ({
  ...createDefaultColumn(p.id || 'c'),
  ...p,
});

export const CG1_DEFAULT: ColumnGolden = {
  id: 'CG1',
  note: 'Default 300×600 — N–M gần đúng, luôn có warning',
  input: base({ id: 'CG1', name: 'CG1-default' }),
  expect: { vdLimit: 0.65, mustWarnNM: true },
};

export const CG2_SQUARE: ColumnGolden = {
  id: 'CG2',
  note: '400×400 · 8d18',
  input: base({
    id: 'CG2', name: 'CG2-sq', b: 400, h: 400, L0x: 3600, L0y: 3600,
    N: 1500, Mx: 40, My: 40, bars: '8d18', Qx: 50, Qy: 50,
  }),
  expect: { muMin: 0.5, mustWarnNM: true },
};

export const CG3_SLENDER: ColumnGolden = {
  id: 'CG3',
  note: '300×500 · moment lớn',
  input: base({
    id: 'CG3', name: 'CG3-slender', b: 300, h: 500, L0x: 3300, L0y: 3300,
    N: 800, Mx: 120, My: 30, bars: '10d16',
  }),
  expect: { mustWarnNM: true },
};

export const CG4_STOCKY: ColumnGolden = {
  id: 'CG4',
  note: '500×500 nén cao',
  input: base({
    id: 'CG4', name: 'CG4-stocky', b: 500, h: 500, L0x: 3000, L0y: 3000,
    N: 2500, Mx: 20, My: 20, bars: '12d22',
  }),
  expect: { vdLimit: 0.65, mustWarnNM: true },
};

export const CG5_MU_FAIL: ColumnGolden = {
  id: 'CG5',
  note: '4d12 → μ < 1% FAIL',
  input: base({
    id: 'CG5', name: 'CG5-mu-fail', b: 400, h: 400, bars: '4d12',
    N: 500, Mx: 10, My: 10, Qx: 20, Qy: 20,
  }),
  expect: { muPass: false, pass: false, mustWarnNM: true },
};

export const CG6_SHEAR: ColumnGolden = {
  id: 'CG6',
  note: 'ThepDai-style shear sample',
  input: base({
    id: 'CG6', name: 'CG6-shear', b: 600, h: 300, L0x: 3000, L0y: 3000,
    N: 1000, Mx: 30, My: 20, Qx: 100, Qy: 150, bars: '12d20', cover: 50,
    stirrupDia: 10, stirrupSpacing: 200, steel: 'CB400-V', stirrupSteel: 'CB240-T',
  }),
  expect: { vdLimit: 0.65, mustWarnNM: true },
};

export const CG7_INTERACTION_HIGH: ColumnGolden = {
  id: 'CG7',
  note: 'N–M interaction cao (định hướng)',
  input: base({
    id: 'CG7', name: 'CG7-NM-high', b: 300, h: 300, L0x: 4000, L0y: 4000,
    N: 2000, Mx: 200, My: 150, bars: '8d16',
  }),
  expect: { mustWarnNM: true },
};

export const ALL_COLUMN_GOLDEN: ColumnGolden[] = [
  CG1_DEFAULT, CG2_SQUARE, CG3_SLENDER, CG4_STOCKY, CG5_MU_FAIL, CG6_SHEAR, CG7_INTERACTION_HIGH,
];

export function runColumnGolden(g: ColumnGolden) {
  const r = calcColumn(g.input);
  const errors: string[] = [];
  const e = g.expect;
  if (e.vdLimit != null && r.vdLimit !== e.vdLimit) errors.push(`vdLimit ${r.vdLimit} ≠ ${e.vdLimit}`);
  if (e.muMin != null && r.mu < e.muMin) errors.push(`mu ${r.mu} < ${e.muMin}`);
  if (e.muMax != null && r.mu > e.muMax) errors.push(`mu ${r.mu} > ${e.muMax}`);
  if (e.muPass != null && r.checks.mu.pass !== e.muPass) errors.push(`mu.pass=${r.checks.mu.pass}`);
  if (e.pass != null && r.pass !== e.pass) errors.push(`pass=${r.pass}`);
  if (e.interactionMax != null && r.interaction > e.interactionMax) {
    errors.push(`interaction ${r.interaction} > ${e.interactionMax}`);
  }
  if (e.mustWarnNM) {
    const has = r.warnings.some((w) => /N–M|N-M|gần đúng|VBA|xấp xỉ/i.test(w));
    if (!has) errors.push('Thiếu cảnh báo N–M gần đúng');
  }
  if (!r.interactionApprox) errors.push('interactionApprox phải = true');
  return { result: r, errors, ok: errors.length === 0 };
}
