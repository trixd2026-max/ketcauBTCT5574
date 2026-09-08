import { describe, expect, it } from 'vitest';
import {
  calcFoundation,
  calcRtc,
  bearingCapacityFactors,
  createDefaultFoundation,
  parseFoundationBars,
  type FoundationInput,
} from './foundation';
import { ALL_GOLDEN, G1_M1_ULS_PMAX_NCT, G2_M1_R19, runGolden } from './foundation.golden';

const base = (p: Partial<FoundationInput>): FoundationInput => ({ ...createDefaultFoundation('t'), ...p });

describe('parseFoundationBars', () => {
  it('d12a150 ≈ 754 mm²/m', () => {
    const p = parseFoundationBars('d12a150');
    expect(p.ok).toBe(true);
    expect(p.As).toBeGreaterThan(700);
  });
});

describe('Bearing factors A,B,D (φ=12° MongDon)', () => {
  it('A=0.235 B=1.94 D=4.421', () => {
    const f = bearingCapacityFactors(12);
    expect(f.A).toBeCloseTo(0.235, 3);
    expect(f.B).toBeCloseTo(1.94, 2);
    expect(f.D).toBeCloseTo(4.421, 3);
  });
});

describe('Rtc MongDon', () => {
  it('Lx=1.5 Ly=1.2 → Rtc≈146.976', () => {
    const r = calcRtc({
      Lx: 1.5, Ly: 1.2, Df: 1.5, phi: 12, cII: 19.5, gammaII: 19.1, gammaPrime: 20,
      m1: 1.1, m2: 1, k: 1.1, zwt: 1, h0Basement: 0,
    });
    expect(r.rtcCalc).toBeCloseTo(146.9757, 3);
  });
  it('Lx=Ly=1 → Rtc≈146.548', () => {
    const r = calcRtc({
      Lx: 1, Ly: 1, Df: 1.5, phi: 12, cII: 19.5, gammaII: 19.1, gammaPrime: 20,
      m1: 1.1, m2: 1, k: 1.1, zwt: 1, h0Basement: 0,
    });
    expect(r.rtcCalc).toBeCloseTo(146.548, 2);
  });
});

describe('ΣN = FZ + Htn·γ·Af', () => {
  it('matches MongDon R18', () => {
    const r = calcFoundation(
      base({
        Lx: 1.5, Ly: 1.2, Hf: 0.35, Df: 1.5, colB: 0.5, colH: 0.2,
        N: 170.91357170184887, Htn: 0.3, gammaFill: 20, gammaPrime: 20,
        Mx: 26.49959551715804, My: 35.078288741447125, pg: 1.5,
        concrete: 'B20', a: 50, barsX: 'd12a150', barsY: 'd12a150',
      })
    );
    expect(r.sigmaN).toBeCloseTo(181.71357170184888, 6);
    expect(r.pMax).toBeCloseTo(284.0137245852376, 4);
    expect(r.punching.Nct).toBeCloseTo(261.29262661841847, 4);
  });
});

describe('MongDon numeric golden (tol ≤ 0.1%)', () => {
  for (const g of ALL_GOLDEN) {
    it(`${g.id}: ${g.note}`, () => {
      const { ok, errors } = runGolden(g);
      expect(errors, errors.join(' | ')).toEqual([]);
      expect(ok).toBe(true);
    });
  }
});

describe('G1 exact digits', () => {
  const { result: r } = runGolden(G1_M1_ULS_PMAX_NCT);
  it('p_max / Nct / Nkt', () => {
    expect(r.pMax).toBeCloseTo(284.0137245852376, 6);
    expect(r.punching.Nct).toBeCloseTo(261.29262661841847, 6);
    expect(r.punching.Nkt).toBeCloseTo(526.5, 6);
  });
});

describe('G2 R19', () => {
  it('Nct = p_max × Act', () => {
    const { result: r } = runGolden(G2_M1_R19);
    expect(r.punching.Nct).toBeCloseTo(r.pMax * r.punching.Act, 9);
  });
});
