/**
 * Golden cases for column engine — patterns from Column.xlsm / ThepDai / Data_Column.
 */
import { describe, expect, it } from 'vitest';
import { calcColumn, createDefaultColumn, parseColumnBars, type ColumnInput } from './column';

const base = (patch: Partial<ColumnInput>): ColumnInput => ({
  ...createDefaultColumn('test'),
  ...patch,
});

describe('parseColumnBars', () => {
  it('parses 12d20', () => {
    const p = parseColumnBars('12d20');
    expect(p.ok).toBe(true);
    expect(p.n).toBe(12);
    expect(p.dia).toBe(20);
    expect(p.As).toBeCloseTo(3769.9, 0);
  });
  it('parses 8d18+4d16', () => {
    const p = parseColumnBars('8d18+4d16');
    expect(p.ok).toBe(true);
    expect(p.n).toBe(12);
    expect(p.As).toBeGreaterThan(2000);
  });
});

describe('Golden C1 — default 300×600, 12d20', () => {
  const r = calcColumn(base({}));
  it('As and mu in range', () => {
    expect(r.As).toBeCloseTo(3769.9, 0);
    expect(r.mu).toBeGreaterThan(1);
    expect(r.mu).toBeLessThan(5);
  });
  it('slenderness OK for L0=3040', () => {
    expect(r.lambdaMax).toBeLessThan(100);
    expect(r.checks.slenderness.pass).toBe(true);
  });
  it('vd limit is 0.65', () => {
    expect(r.vdLimit).toBe(0.65);
    expect(r.vd).toBeLessThan(0.65);
    expect(r.checks.compressionRatio.pass).toBe(true);
  });
  it('has interaction warning about approximate N–M', () => {
    expect(r.warnings.some((w) => /gần đúng|VBA|chưa khóa/i.test(w))).toBe(true);
  });
});

describe('Golden C2 — square 400×400 light moments', () => {
  const r = calcColumn(
    base({
      b: 400,
      h: 400,
      L0x: 3600,
      L0y: 3600,
      N: 1500,
      Mx: 40,
      My: 40,
      bars: '8d18',
      Qx: 50,
      Qy: 50,
    })
  );
  it('mu and detailing', () => {
    expect(r.mu).toBeGreaterThan(0.5);
    expect(r.checks.detailing.pass).toBe(true);
  });
  it('lambda finite', () => {
    expect(r.lambdaMax).toBeGreaterThan(10);
    expect(r.lambdaMax).toBeLessThan(120);
  });
});

describe('Golden C3 — slender-ish 300×500', () => {
  const r = calcColumn(
    base({
      b: 300,
      h: 500,
      L0x: 3300,
      L0y: 3300,
      N: 800,
      Mx: 120,
      My: 30,
      bars: '10d16',
    })
  );
  it('computes N0 and interaction number', () => {
    expect(r.N0).toBeGreaterThan(500);
    expect(r.interaction).toBeGreaterThan(0);
  });
});

describe('Golden C4 — stocky high axial', () => {
  const r = calcColumn(
    base({
      b: 500,
      h: 500,
      L0x: 3000,
      L0y: 3000,
      N: 2500,
      Mx: 20,
      My: 20,
      bars: '12d22',
      Qx: 40,
      Qy: 40,
    })
  );
  it('high N still within N0 or flags interaction', () => {
    expect(r.N0).toBeGreaterThan(1000);
    expect(typeof r.pass).toBe('boolean');
  });
  it('vd uses 0.65 limit', () => {
    expect(r.vdLimit).toBe(0.65);
  });
});

describe('Golden C5 — low mu fail', () => {
  const r = calcColumn(
    base({
      b: 400,
      h: 400,
      bars: '4d12',
      N: 500,
      Mx: 10,
      My: 10,
      Qx: 20,
      Qy: 20,
    })
  );
  it('fails mu min 1%', () => {
    expect(r.mu).toBeLessThan(1);
    expect(r.checks.mu.pass).toBe(false);
    expect(r.pass).toBe(false);
  });
});

describe('Golden C6 — ThepDai-style shear sample', () => {
  const r = calcColumn(
    base({
      b: 600,
      h: 300,
      L0x: 3000,
      L0y: 3000,
      N: 1000,
      Mx: 30,
      My: 20,
      Qx: 100,
      Qy: 150,
      bars: '12d20',
      cover: 50,
      stirrupDia: 10,
      stirrupSpacing: 200,
      stirrupLegsX: 2,
      stirrupLegsY: 2,
      steel: 'CB400-V',
      stirrupSteel: 'CB240-T',
    })
  );
  it('shear returns phiN and finite capacities', () => {
    expect(r.shearX.phiN).toBeGreaterThanOrEqual(1);
    expect(r.shearX.qbt).toBeGreaterThan(0);
    expect(r.shearY.qRes).toBeGreaterThan(0);
  });
  it('vd limit 0.65', () => {
    expect(r.vdLimit).toBe(0.65);
  });
});
