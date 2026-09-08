/**
 * Golden MongDon.xlsm — đối chiếu số thật (Design_MongDon_ALL).
 *
 * Công thức workbook đã xác nhận:
 *   ΣN  = FZ + Htn·γ·Af
 *   ΣMx = MX − FY·Hf − FZ·ey
 *   ΣMy = MY + FX·Hf + FZ·ex
 *   p   = ΣN/Af ± |ΣMx|/Wx ± |ΣMy|/Wy + γ·Df + pg
 *   Nct = p_max · Act
 *   Nkt = 0.75 · Rbt · um · h0 · 1000
 *
 * Input N/Mx/My của engine = lực đã quy về đáy (ΣN, ΣMx, ΣMy).
 * Sai số tương đối mục tiêu ≤ 0.1 % (áp lực, Nct, Nkt).
 */
import type { FoundationInput } from './foundation';
import { calcFoundation, createDefaultFoundation } from './foundation';

export type GoldenCase = {
  id: string;
  note: string;
  input: FoundationInput;
  expect: {
    Af?: number;
    Wx?: number;
    Wy?: number;
    pAvg?: number;
    pMax?: number;
    pMin?: number;
    um?: number;
    Act?: number;
    Nct?: number;
    Nkt?: number;
    soilMinPass?: boolean;
    punchingPass?: boolean;
  };
};

const base = (p: Partial<FoundationInput>): FoundationInput => ({
  ...createDefaultFoundation(p.id || 'g'),
  ...p,
});

function near(actual: number, expected: number, relTol = 0.001, absTol = 0.05): boolean {
  if (!Number.isFinite(actual) || !Number.isFinite(expected)) return false;
  const abs = Math.abs(actual - expected);
  if (abs <= absTol) return true;
  const den = Math.max(Math.abs(expected), 1e-9);
  return abs / den <= relTol;
}

/** Row 18 — M1 ULS01 */
export const G1_M1_ULS_PMAX_NCT: GoldenCase = {
  id: 'G1',
  note: 'MongDon R18 M1: p_max / Nct / Nkt khớp tuyệt đối',
  input: base({
    id: 'G1',
    name: 'M1-R18',
    Lx: 1.5,
    Ly: 1.2,
    Hf: 0.35,
    Df: 1.5,
    colB: 0.5,
    colH: 0.2,
    N: 181.71357170184888,
    Mx: 26.49959551715804,
    My: 35.078288741447125,
    Rtc: 146.9757,
    concrete: 'B20',
    steel: 'CB400-V',
    a: 50,
    barsX: 'd12a150',
    barsY: 'd12a150',
    gammaFill: 20,
    pg: 1.5,
  }),
  expect: {
    Af: 1.8,
    Wx: 0.36,
    Wy: 0.45,
    pAvg: 132.45198427880496,
    pMax: 284.0137245852376,
    pMin: -19.109756027627668,
    um: 2.6,
    Act: 0.92,
    Nct: 261.29262661841847,
    Nkt: 526.5,
    soilMinPass: false,
    punchingPass: true,
  },
};

/** Row 19 — overhangs lệch tâm */
export const G2_M1_R19: GoldenCase = {
  id: 'G2',
  note: 'MongDon R19: p_max / Nct (cx/cy lệch tâm)',
  input: base({
    id: 'G2',
    name: 'M1-R19',
    Lx: 1.0,
    Ly: 1.0,
    Hf: 0.35,
    Df: 1.5,
    colB: 0.3,
    colH: 0.2,
    N: 29.959830286743696,
    Mx: 4.825386568659056,
    My: 3.9291712459923502,
    Rtc: 146.548,
    concrete: 'B20',
    steel: 'CB400-V',
    a: 50,
    barsX: 'd12a150',
    barsY: 'd12a150',
    gammaFill: 20,
    pg: 1.5,
    cx1: 0,
    cx2: 0.7,
    cy1: 0.8,
    cy2: 0,
  }),
  expect: {
    Af: 1.0,
    Wx: 1 / 6,
    Wy: 1 / 6,
    pMax: 113.98717717465213,
    pMin: 8.93248339883526,
    um: 1.6,
    Act: 0.7,
    Nct: 79.7910240222565,
    Nkt: 324,
    soilMinPass: true,
    punchingPass: true,
  },
};

export const G3_M2_R20: GoldenCase = {
  id: 'G3',
  note: 'MongDon R20 M2: p_max / p_min',
  input: base({
    id: 'G3',
    name: 'M2-R20',
    Lx: 1.5,
    Ly: 1.5,
    Hf: 0.35,
    Df: 1.5,
    colB: 0.3,
    colH: 0.2,
    N: 61.365053558750205,
    Mx: 29.338480843978886,
    My: 26.312172095075763,
    Rtc: 147.61725,
    concrete: 'B20',
    steel: 'CB400-V',
    a: 50,
    barsX: 'd14a150',
    barsY: 'd14a150',
    gammaFill: 20,
    pg: 1.5,
  }),
  expect: {
    Af: 2.25,
    Wx: 0.5625,
    Wy: 0.5625,
    pMax: 157.70785125109725,
    pMin: -40.161136976652614,
    soilMinPass: false,
  },
};

export const G4_M4_PUNCH_FAIL: GoldenCase = {
  id: 'G4',
  note: 'MongDon R22: p_max / p_min',
  input: base({
    id: 'G4',
    name: 'M4-R22',
    Lx: 2.0,
    Ly: 1.5,
    Hf: 0.35,
    Df: 1.5,
    colB: 0.3,
    colH: 0.2,
    N: 118.8055054735909,
    Mx: 61.372933536256184,
    My: 0.32985919971812416,
    Rtc: 147.61725,
    concrete: 'B20',
    steel: 'CB400-V',
    a: 50,
    barsX: 'd14a100',
    barsY: 'd14a100',
    gammaFill: 20,
    pg: 1.5,
  }),
  expect: {
    Af: 3.0,
    Wx: 0.75,
    Wy: 1.0,
    pMax: 153.26227240592334,
    pMin: -11.058602090196068,
    soilMinPass: false,
  },
};

export const G5_DEFAULT_SMOKE: GoldenCase = {
  id: 'G5',
  note: 'Default 2×2 smoke',
  input: base({ id: 'G5', name: 'Default' }),
  expect: { Af: 4 },
};

export const G6_SOIL_FAIL: GoldenCase = {
  id: 'G6',
  note: 'N cao → p_max > 1.2Rtc',
  input: base({
    id: 'G6',
    name: 'Soil-FAIL',
    Lx: 1.5,
    Ly: 1.5,
    N: 5000,
    Mx: 50,
    My: 50,
    Rtc: 150,
    barsX: 'd16a100',
    barsY: 'd16a100',
  }),
  expect: { pMax: 150 },
};

export const ALL_GOLDEN: GoldenCase[] = [
  G1_M1_ULS_PMAX_NCT,
  G2_M1_R19,
  G3_M2_R20,
  G4_M4_PUNCH_FAIL,
  G5_DEFAULT_SMOKE,
  G6_SOIL_FAIL,
];

export function runGolden(g: GoldenCase) {
  const r = calcFoundation(g.input);
  const errors: string[] = [];
  const e = g.expect;
  const check = (label: string, actual: number, expected: number | undefined) => {
    if (expected == null) return;
    if (!near(actual, expected)) {
      errors.push(`${label}: ${actual} ≠ ${expected} (tol 0.1%)`);
    }
  };

  check('Af', r.Af, e.Af);
  check('Wx', r.Wx, e.Wx);
  check('Wy', r.Wy, e.Wy);
  check('pAvg', r.pAvg, e.pAvg);
  check('pMax', r.pMax, e.pMax);
  check('pMin', r.pMin, e.pMin);
  check('um', r.punching.um, e.um);
  check('Act', r.punching.Act, e.Act);
  check('Nct', r.punching.Nct, e.Nct);
  check('Nkt', r.punching.Nkt, e.Nkt);

  if (e.soilMinPass != null && r.soilMin.pass !== e.soilMinPass) {
    errors.push(`soilMin.pass=${r.soilMin.pass} expected ${e.soilMinPass}`);
  }
  if (e.punchingPass != null && r.punching.pass !== e.punchingPass) {
    errors.push(`punching.pass=${r.punching.pass} expected ${e.punchingPass}`);
  }

  if (g.id === 'G6') {
    const ok = r.pMax >= (e.pMax ?? 0);
    return {
      result: r,
      errors: ok ? [] : [`pMax ${r.pMax} < ${e.pMax}`],
      ok,
    };
  }

  return { result: r, errors, ok: errors.length === 0 };
}
