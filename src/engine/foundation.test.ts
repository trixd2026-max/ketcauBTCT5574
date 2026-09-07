import { describe, expect, it } from 'vitest';
import { calcFoundation, createDefaultFoundation, parseFoundationBars, type FoundationInput } from './foundation';

const base = (p: Partial<FoundationInput>): FoundationInput => ({ ...createDefaultFoundation('t'), ...p });

describe('parseFoundationBars', () => {
  it('d12a150', () => {
    const p = parseFoundationBars('d12a150');
    expect(p.ok).toBe(true);
    expect(p.As).toBeGreaterThan(700);
  });
});

describe('Golden F1 — default 2x2 footing', () => {
  const r = calcFoundation(base({}));
  it('computes pressures', () => {
    expect(r.Af).toBeCloseTo(4, 2);
    expect(r.pAvg).toBeGreaterThan(0);
    expect(r.pMax).toBeGreaterThanOrEqual(r.pAvg);
  });
  it('has finite steel req', () => {
    expect(r.AsXReq).toBeGreaterThanOrEqual(0);
    expect(r.AsXMin).toBeGreaterThan(0);
  });
});

describe('Golden F2 — high load fails soil', () => {
  const r = calcFoundation(base({ N: 5000, Rtc: 150, Lx: 1.5, Ly: 1.5 }));
  it('soil may fail', () => {
    expect(r.pMax).toBeGreaterThan(150);
  });
});

describe('Golden F3 — heavy steel passes flexure', () => {
  const r = calcFoundation(
    base({
      Lx: 2.5,
      Ly: 2.5,
      Hf: 0.6,
      N: 600,
      Mx: 40,
      My: 40,
      barsX: 'd14a100',
      barsY: 'd14a100',
      Rtc: 250,
    })
  );
  it('As prov high', () => {
    expect(r.AsXProv).toBeGreaterThan(1000);
  });
});

describe('Golden F4 — uplift case', () => {
  const r = calcFoundation(base({ N: 100, Mx: 200, My: 200, Lx: 1.8, Ly: 1.8, Rtc: 200 }));
  it('p_min can be negative', () => {
    expect(typeof r.soilMin.pass).toBe('boolean');
  });
});

describe('Golden F5 — punching numbers finite', () => {
  const r = calcFoundation(base({}));
  it('Nkt > 0', () => {
    expect(r.punching.Nkt).toBeGreaterThan(0);
    expect(r.punching.um).toBeGreaterThan(0);
  });
});
