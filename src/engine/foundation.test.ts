import { describe, expect, it } from 'vitest';
import { calcFoundation, createDefaultFoundation, parseFoundationBars, type FoundationInput } from './foundation';
import { ALL_GOLDEN, G1_M1_ULS_PMAX_NCT, G2_M1_R19, runGolden } from './foundation.golden';

const base = (p: Partial<FoundationInput>): FoundationInput => ({ ...createDefaultFoundation('t'), ...p });

describe('parseFoundationBars', () => {
  it('d12a150 ≈ 754 mm²/m', () => {
    const p = parseFoundationBars('d12a150');
    expect(p.ok).toBe(true);
    expect(p.As).toBeGreaterThan(700);
    expect(p.As).toBeCloseTo((Math.PI * 144) / 4 * (1000 / 150), 0);
  });
});

describe('MongDon numeric golden (tol ≤ 0.1%)', () => {
  for (const g of ALL_GOLDEN) {
    it(`${g.id}: ${g.note}`, () => {
      const { ok, errors, result } = runGolden(g);
      expect(errors, errors.join(' | ')).toEqual([]);
      expect(ok).toBe(true);
      expect(Number.isFinite(result.pMax)).toBe(true);
    });
  }
});

describe('G1 exact digits vs workbook R18', () => {
  const { result: r } = runGolden(G1_M1_ULS_PMAX_NCT);
  it('p_max = 284.0137…', () => {
    expect(r.pMax).toBeCloseTo(284.0137245852376, 6);
  });
  it('Nct = 261.2926…', () => {
    expect(r.punching.Nct).toBeCloseTo(261.29262661841847, 6);
  });
  it('Nkt = 526.5', () => {
    expect(r.punching.Nkt).toBeCloseTo(526.5, 6);
  });
  it('um / Act', () => {
    expect(r.punching.um).toBeCloseTo(2.6, 6);
    expect(r.punching.Act).toBeCloseTo(0.92, 6);
  });
});

describe('G2 R19 Nct', () => {
  it('Nct ≈ p_max × Act', () => {
    const { result: r } = runGolden(G2_M1_R19);
    expect(r.punching.Nct).toBeCloseTo(r.pMax * r.punching.Act, 9);
    expect(r.punching.Nkt).toBeCloseTo(324, 6);
  });
});

describe('Regression', () => {
  it('default Af=4', () => {
    const r = calcFoundation(base({}));
    expect(r.Af).toBeCloseTo(4, 2);
    expect(r.punching.Nkt).toBeGreaterThan(0);
  });
  it('M1 modulus Wx Wy', () => {
    const r = calcFoundation(base({ Lx: 1.5, Ly: 1.2 }));
    expect(r.Wx).toBeCloseTo(0.36, 6);
    expect(r.Wy).toBeCloseTo(0.45, 6);
  });
});
