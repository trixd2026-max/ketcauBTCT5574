import { describe, expect, it } from 'vitest';
import { calcBeam, createDefaultBeam } from './beam';
import { calcCrack } from './crack';

describe('Golden cases ULS + SLS', () => {
  it('GC01 — B25 flexure+shear reference from Beam.xlsm', () => {
    const beam = createDefaultBeam('gc01');
    Object.assign(beam, {
      b: 300, h: 700, aTop: 66, aBottom: 66,
      MNegative: 262.83361927343867, MPositive: 4.699579173398598, Q: 169.5460132491527,
      concrete: 'B25', steel: 'CB400-V', stirrupSteel: 'CB240-T',
      AsTop: 1344.6016557364314, AsBottom: 942.4777960769379,
      stirrupLegs: 2, stirrupDia: 12, stirrupSpacing: 100, L: 6.5,
    });
    const result = calcBeam(beam);
    expect(result.negative.ho).toBe(634);
    expect(result.negative.alphaM).toBeCloseTo(0.1503187455, 8);
    expect(result.negative.xi).toBe(0.164);
    expect(result.shear.qbt).toBeCloseTo(827.37, 6);
    expect(result.shear.qResistance).toBeCloseTo(600.72, 1);
    expect(result.negative.check.pass).toBe(true);
    expect(result.shear.check.pass).toBe(true);
  });

  it('GC02 — default beam passes ULS', () => {
    const result = calcBeam(createDefaultBeam('gc02'));
    expect(result.negative.check.pass).toBe(true);
    expect(result.positive.check.pass).toBe(true);
    expect(result.shear.check.pass).toBe(true);
  });

  it('GC03 — insufficient As fails flexure', () => {
    const beam = createDefaultBeam('gc03');
    beam.AsBottom = 100;
    expect(calcBeam(beam).positive.check.pass).toBe(false);
  });

  it('GC04 — crack: low service moment → no crack', () => {
    const r = calcCrack({
      b: 300, h: 600, a: 50, aPrime: 50, As: 942, AsPrime: 942, ds: 16,
      concrete: 'B25', steel: 'CB400-V', Mshort: 20, Mlong: 15,
    });
    expect(r.cracked).toBe(false);
    expect(r.pass).toBe(true);
    expect(r.Mcrc).toBeGreaterThan(20);
  });

  it('GC05 — crack: high service moment → cracks and checks width', () => {
    const r = calcCrack({
      b: 300, h: 600, a: 50, aPrime: 50, As: 942, AsPrime: 300, ds: 16,
      concrete: 'B25', steel: 'CB400-V', Mshort: 120, Mlong: 90,
    });
    expect(r.Mcrc).toBeGreaterThan(0);
    expect(r.cracked).toBe(true);
    expect(r.acrcShort).not.toBeNull();
    expect(r.Ls).toBeGreaterThan(0);
  });

  it('GC06 — deflection needs L', () => {
    const beam = createDefaultBeam('gc06');
    beam.L = 0;
    const r = calcBeam(beam);
    expect(r.deflection.warnings.length).toBeGreaterThan(0);
  });

  it('GC07 — beam with L has deflection numbers', () => {
    const beam = createDefaultBeam('gc07');
    beam.L = 6;
    const r = calcBeam(beam);
    expect(r.deflection.deltaShort).toBeGreaterThanOrEqual(0);
    expect(r.deflection.limit).toBeCloseTo(6000 / 250, 0);
  });
});
