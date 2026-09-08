import { describe, expect, it } from 'vitest';
import { calcFoundation, createDefaultFoundation, parseFoundationBars, type FoundationInput } from './foundation';
import { ALL_GOLDEN, runGolden } from './foundation.golden';

const base = (p: Partial<FoundationInput>): FoundationInput => ({ ...createDefaultFoundation('t'), ...p });

describe('parseFoundationBars', () => {
  it('d12a150', () => {
    const p = parseFoundationBars('d12a150');
    expect(p.ok).toBe(true);
    expect(p.As).toBeGreaterThan(700);
  });
});

describe('Golden suite MongDon-aligned', () => {
  for (const g of ALL_GOLDEN) {
    it(`${g.id}: ${g.note}`, () => {
      const { ok, errors } = runGolden(g);
      expect(errors, errors.join('; ')).toEqual([]);
      expect(ok).toBe(true);
    });
  }
});

describe('Regression suite', () => {
  it('default Af=4', () => {
    const r = calcFoundation(base({}));
    expect(r.Af).toBeCloseTo(4, 2);
    expect(r.punching.Nkt).toBeGreaterThan(0);
  });
  it('high load pMax', () => {
    const r = calcFoundation(base({ N: 5000, Rtc: 150, Lx: 1.5, Ly: 1.5 }));
    expect(r.pMax).toBeGreaterThan(150);
  });
  it('M1 modulus', () => {
    const r = calcFoundation(base({ Lx: 1.5, Ly: 1.2, N: 170.91, Mx: 0.69, My: 0.71 }));
    expect(r.Wx).toBeCloseTo(0.36, 6);
    expect(r.Wy).toBeCloseTo(0.45, 6);
  });
});
