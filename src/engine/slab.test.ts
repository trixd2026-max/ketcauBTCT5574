import { describe, expect, it } from 'vitest';
import { calcSlab, createDefaultSlab, parseSlabBars, type SlabInput } from './slab';

const base = (p: Partial<SlabInput>): SlabInput => ({ ...createDefaultSlab('t'), ...p });

describe('parseSlabBars', () => {
  it('d10a200 → As/m', () => {
    const p = parseSlabBars('d10a200', 1000);
    expect(p.ok).toBe(true);
    expect(p.As).toBeCloseTo(392.7, 0);
  });
  it('d12@150', () => {
    const p = parseSlabBars('d12@150', 1000);
    expect(p.ok).toBe(true);
    expect(p.As).toBeGreaterThan(700);
  });
});

describe('Golden S1 — default slab', () => {
  const r = calcSlab(base({}));
  it('has finite As req and prov', () => {
    expect(r.AsTopProv).toBeGreaterThan(300);
    expect(r.AsBotProv).toBeGreaterThan(500);
    expect(r.AsTopReq).toBeGreaterThan(0);
  });
  it('muMin is 0.1', () => {
    expect(r.muMin).toBe(0.1);
  });
});

describe('Golden S2 — Slab_Design SB23-like h=150 Mtop=5', () => {
  const r = calcSlab(
    base({
      h: 150,
      Mtop: 5,
      Mbot: 4.1,
      aTop: 38,
      aBottom: 35,
      barsTop: 'd12a200',
      barsBottom: 'd10a200',
      Q: 15,
      L: 4,
    })
  );
  it('flexure computes', () => {
    expect(Number.isFinite(r.AsTopReq)).toBe(true);
    expect(r.MuTop).toBeGreaterThan(0);
  });
});

describe('Golden S3 — thin slab low mu', () => {
  const r = calcSlab(
    base({
      h: 120,
      Mtop: 8,
      Mbot: 10,
      barsTop: 'd8a300',
      barsBottom: 'd8a300',
      Q: 20,
    })
  );
  it('may fail flexure or mu', () => {
    expect(typeof r.pass).toBe('boolean');
    expect(r.AsTopProv).toBeLessThan(200);
  });
});

describe('Golden S4 — adequate bars', () => {
  const r = calcSlab(
    base({
      h: 180,
      Mtop: 15,
      Mbot: 20,
      barsTop: 'd12a150',
      barsBottom: 'd14a150',
      Q: 30,
      L: 5,
    })
  );
  it('As prov > req typically', () => {
    expect(r.AsBotProv).toBeGreaterThan(r.AsBotReq * 0.9);
  });
});
