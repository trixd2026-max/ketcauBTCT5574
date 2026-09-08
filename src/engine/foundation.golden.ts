import type { FoundationInput } from './foundation';
import { calcFoundation, createDefaultFoundation } from './foundation';

export type GoldenCase = {
  id: string;
  note: string;
  input: FoundationInput;
  expect: {
    Af?: number; Wx?: number; Wy?: number;
    pAvgMin?: number; pAvgMax?: number; pMaxMin?: number; pMaxMax?: number;
    soilMinPass?: boolean; punchingPass?: boolean; NktMin?: number;
  };
};

const base = (p: Partial<FoundationInput>): FoundationInput => ({
  ...createDefaultFoundation(p.id || 'g'),
  ...p,
});

export const G1_MONGDON_M1_MODULUS: GoldenCase = {
  id: 'G1',
  note: 'MongDon M1 modulus Wx/Wy/Af',
  input: base({
    id: 'G1', name: 'M1-modulus', Lx: 1.5, Ly: 1.2, Hf: 0.35, Df: 1.5,
    colB: 0.5, colH: 0.2, N: 170.91, Mx: 0.69, My: 0.71, Rtc: 147,
    concrete: 'B20', steel: 'CB400-V', a: 50, barsX: 'd12a150', barsY: 'd12a150',
    gammaFill: 20, pg: 1.5,
  }),
  expect: { Af: 1.8, Wx: 0.36, Wy: 0.45 },
};

export const G2_SOIL_OK: GoldenCase = {
  id: 'G2', note: 'Đất OK',
  input: base({
    id: 'G2', name: 'Soil-OK', Lx: 2.5, Ly: 2.5, Hf: 0.5, Df: 1.2,
    colB: 0.4, colH: 0.4, N: 600, Mx: 30, My: 30, Rtc: 250,
    barsX: 'd14a150', barsY: 'd14a150', gammaFill: 18, pg: 0,
  }),
  expect: { soilMinPass: true, punchingPass: true },
};

export const G3_SOIL_FAIL: GoldenCase = {
  id: 'G3', note: 'Nền FAIL',
  input: base({
    id: 'G3', name: 'Soil-FAIL', Lx: 1.5, Ly: 1.5, Hf: 0.4, Df: 1.0,
    N: 5000, Mx: 50, My: 50, Rtc: 150, barsX: 'd16a100', barsY: 'd16a100',
  }),
  expect: { pMaxMin: 150 },
};

export const G4_STEEL_HEAVY: GoldenCase = {
  id: 'G4', note: 'Thép dầy',
  input: base({
    id: 'G4', name: 'Steel-heavy', Lx: 2.5, Ly: 2.5, Hf: 0.6, N: 600, Mx: 40, My: 40,
    Rtc: 250, barsX: 'd14a100', barsY: 'd14a100',
  }),
  expect: {},
};

export const G5_UPLIFT: GoldenCase = {
  id: 'G5', note: 'Lệch tâm lớn',
  input: base({
    id: 'G5', name: 'Uplift', Lx: 1.8, Ly: 1.8, Hf: 0.4, N: 100, Mx: 200, My: 200, Rtc: 200,
    barsX: 'd12a150', barsY: 'd12a150',
  }),
  expect: {},
};

export const G6_PUNCHING: GoldenCase = {
  id: 'G6', note: 'Chọc thủng Nkt',
  input: base({
    id: 'G6', name: 'Punching', Lx: 2.0, Ly: 2.0, Hf: 0.5, colB: 0.4, colH: 0.4,
    N: 800, Mx: 50, My: 40, Rtc: 200, concrete: 'B25', barsX: 'd12a150', barsY: 'd12a150',
  }),
  expect: { NktMin: 100 },
};

export const ALL_GOLDEN: GoldenCase[] = [
  G1_MONGDON_M1_MODULUS, G2_SOIL_OK, G3_SOIL_FAIL, G4_STEEL_HEAVY, G5_UPLIFT, G6_PUNCHING,
];

export function runGolden(g: GoldenCase) {
  const r = calcFoundation(g.input);
  const errors: string[] = [];
  const e = g.expect;
  if (e.Af != null && Math.abs(r.Af - e.Af) > 1e-6) errors.push(`Af ${r.Af} ≠ ${e.Af}`);
  if (e.Wx != null && Math.abs(r.Wx - e.Wx) > 1e-6) errors.push(`Wx ${r.Wx} ≠ ${e.Wx}`);
  if (e.Wy != null && Math.abs(r.Wy - e.Wy) > 1e-6) errors.push(`Wy ${r.Wy} ≠ ${e.Wy}`);
  if (e.pMaxMin != null && r.pMax < e.pMaxMin) errors.push(`pMax ${r.pMax}`);
  if (e.soilMinPass != null && r.soilMin.pass !== e.soilMinPass) errors.push('soilMin');
  if (e.punchingPass != null && r.punching.pass !== e.punchingPass) errors.push('punching');
  if (e.NktMin != null && r.punching.Nkt < e.NktMin) errors.push(`Nkt ${r.punching.Nkt}`);
  return { result: r, errors, ok: errors.length === 0 };
}
