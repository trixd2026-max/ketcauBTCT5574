import { describe, expect, it } from 'vitest';
import { calcBeam, createDefaultBeam } from './beam';

describe('Beam.xlsm KiemTraUonCat formulas', () => {
  it('matches the extracted B25 flexure reference case', () => {
    const beam = createDefaultBeam('reference');
    Object.assign(beam, { b: 300, h: 700, aTop: 66, aBottom: 66, MNegative: 262.83361927343867, MPositive: 4.699579173398598, Q: 169.5460132491527, concrete: 'B25', steel: 'CB400-V', stirrupSteel: 'CB240-T', AsTop: 1344.6016557364314, AsBottom: 942.4777960769379, stirrupLegs: 2, stirrupDia: 12, stirrupSpacing: 100 });
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

  it('flags insufficient flexural reinforcement', () => {
    const beam = createDefaultBeam('fail');
    beam.AsBottom = 100;
    expect(calcBeam(beam).positive.check.pass).toBe(false);
  });
});
