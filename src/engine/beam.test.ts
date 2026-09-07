import { describe, expect, it } from 'vitest';
import { calcBeam, createDefaultBeam } from './beam';

describe('Golden cases from Beam.xlsm / KiemTraUonCat + TCVN 5574:2018', () => {
  it('GC01 — extracted B25 flexure+shear reference (BX2-1 style)', () => {
    const beam = createDefaultBeam('gc01');
    Object.assign(beam, {
      b: 300, h: 700, aTop: 66, aBottom: 66,
      MNegative: 262.83361927343867, MPositive: 4.699579173398598, Q: 169.5460132491527,
      concrete: 'B25', steel: 'CB400-V', stirrupSteel: 'CB240-T',
      AsTop: 1344.6016557364314, AsBottom: 942.4777960769379,
      stirrupLegs: 2, stirrupDia: 12, stirrupSpacing: 100,
    });
    const result = calcBeam(beam);
    expect(result.negative.ho).toBe(634);
    expect(result.negative.alphaM).toBeCloseTo(0.1503187455, 8);
    expect(result.negative.xi).toBe(0.164);
    expect(result.negative.xiR).toBeCloseTo(0.5333333333, 8);
    expect(result.negative.AsRequired).toBeCloseTo(1292.2731429, 6);
    expect(result.negative.muMax).toBeCloseTo(2.2095238095, 8);
    expect(result.shear.qbt).toBeCloseTo(827.37, 6);
    expect(result.shear.qB).toBeCloseTo(299.565, 6);
    expect(result.shear.qSw).toBeCloseTo(301.155585, 6);
    expect(result.shear.qResistance).toBeCloseTo(600.720585, 6);
    expect(result.pass).toBe(true);
  });

  it('GC02 — default practical beam 300x600 B25 (pass)', () => {
    const beam = createDefaultBeam('gc02');
    const result = calcBeam(beam);
    expect(result.negative.ho).toBe(550);
    expect(result.negative.AsRequired).toBeCloseTo(655.7, 0);
    expect(result.positive.AsRequired).toBeCloseTo(539.7, 0);
    expect(result.pass).toBe(true);
  });

  it('GC03 — flags insufficient flexural reinforcement', () => {
    const beam = createDefaultBeam('gc03');
    beam.AsBottom = 100;
    const result = calcBeam(beam);
    expect(result.positive.check.pass).toBe(false);
    expect(result.pass).toBe(false);
  });

  it('GC04 — high moment exceeds compression zone limit (αm > 0.5)', () => {
    const beam = createDefaultBeam('gc04');
    beam.MNegative = 900;
    beam.AsTop = 3000;
    const result = calcBeam(beam);
    expect(result.negative.alphaM).toBeGreaterThan(0.5);
    expect(result.negative.check.pass).toBe(false);
  });

  it('GC05 — shear fails Q > Qbt', () => {
    const beam = createDefaultBeam('gc05');
    beam.Q = 900;
    beam.stirrupSpacing = 80;
    beam.stirrupDia = 12;
    const result = calcBeam(beam);
    expect(result.shear.compressionCheck.pass).toBe(false);
    expect(result.pass).toBe(false);
  });

  it('GC06 — stirrup spacing exceeds smax', () => {
    const beam = createDefaultBeam('gc06');
    beam.stirrupSpacing = 450;
    const result = calcBeam(beam);
    expect(result.shear.spacingCheck.pass).toBe(false);
  });

  it('GC07 — B30 higher grade, lower As required', () => {
    const beam = createDefaultBeam('gc07');
    beam.concrete = 'B30';
    beam.MNegative = 150;
    beam.MPositive = 120;
    const result = calcBeam(beam);
    expect(result.negative.AsRequired).toBeLessThan(700);
    expect(result.pass).toBe(true);
  });

  it('GC08 — CB500-V higher strength steel', () => {
    const beam = createDefaultBeam('gc08');
    beam.steel = 'CB500-V';
    beam.MNegative = 180;
    beam.AsTop = 800;
    const result = calcBeam(beam);
    expect(result.negative.xiR).toBeCloseTo(0.493, 2);
    expect(result.negative.AsRequired).toBeLessThan(650);
  });

  it('GC09 — narrow beam, low mu', () => {
    const beam = createDefaultBeam('gc09');
    beam.b = 200;
    beam.h = 400;
    beam.AsTop = 80;
    beam.AsBottom = 80;
    beam.MNegative = 20;
    beam.MPositive = 15;
    beam.Q = 30;
    const result = calcBeam(beam);
    expect(result.negative.mu).toBeLessThan(0.15);
  });

  it('GC10 — deep beam shear capacity scales with ho', () => {
    const beam = createDefaultBeam('gc10');
    beam.h = 900;
    beam.aTop = 60;
    beam.aBottom = 60;
    beam.Q = 200;
    const result = calcBeam(beam);
    expect(result.shear.ho).toBe(840);
    expect(result.shear.qbt).toBeGreaterThan(1000);
    expect(result.pass).toBe(true);
  });
});
