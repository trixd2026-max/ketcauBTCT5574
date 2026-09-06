import { getConcrete, getSteel } from './materials';

export type BeamInput = {
  id: string; name: string; b: number; h: number; aTop: number; aBottom: number;
  MNegative: number; MPositive: number; Q: number; concrete: string; steel: string; stirrupSteel: string;
  AsTop: number; AsBottom: number; stirrupLegs: number; stirrupDia: number; stirrupSpacing: number;
};
export type Check = { pass: boolean; message: string };
export type FlexureResult = { ho: number; alphaM: number; xi: number; xiR: number; AsRequired: number; AsProvided: number; mu: number; muMin: number; muMax: number; Mu: number; check: Check };
export type BeamResult = { negative: FlexureResult; positive: FlexureResult; shear: { ho: number; qDemand: number; qbt: number; qB: number; qSw: number; qResistance: number; qsw: number; stirrupArea: number; sMax: number; compressionCheck: Check; resistanceCheck: Check; spacingCheck: Check; check: Check }; pass: boolean; warnings: string[] };

const round = (value: number, decimals: number) => Number(value.toFixed(decimals));
const safe = (value: number) => Number.isFinite(value) ? value : 0;
const check = (pass: boolean, message: string): Check => ({ pass, message });

function calcFlexure(moment: number, b: number, h: number, a: number, asProvided: number, concreteName: string, steelName: string): FlexureResult {
  const concrete = getConcrete(concreteName); const steel = getSteel(steelName); const ho = h - a;
  const alphaM = ho > 0 && b > 0 ? Math.abs(moment) * 1e6 / (b * ho ** 2 * concrete.Rb) : Infinity;
  const xi = alphaM >= 0.5 ? 1 : round(1 - Math.sqrt(Math.max(0, 1 - 2 * alphaM)), 3);
  const xiR = 0.8 / (1 + (steel.Rs / steel.Es) / 0.0035);
  const asRequired = safe(concrete.Rb * b * xi * ho / steel.Rs); const mu = ho > 0 && b > 0 ? asProvided * 100 / (b * ho) : 0;
  const muMin = 0.1; const muMax = xiR * 100 * concrete.Rb / steel.Rs;
  const Mu = concrete.Rb * b * xiR * ho ** 2 * (1 - 0.5 * xiR) / 1e6;
  const pass = ho > 0 && alphaM <= 0.5 && xi <= xiR && asProvided >= asRequired && mu >= muMin && mu <= muMax;
  let message = 'Đạt uốn';
  if (ho <= 0) message = 'a phải nhỏ hơn h'; else if (alphaM > 0.5 || xi > xiR) message = 'Tiết diện vượt giới hạn vùng nén'; else if (asProvided < asRequired) message = 'Thiếu cốt thép chịu kéo'; else if (mu < muMin) message = 'Hàm lượng thép nhỏ hơn tối thiểu'; else if (mu > muMax) message = 'Hàm lượng thép lớn hơn tối đa';
  return { ho, alphaM: safe(alphaM), xi, xiR, AsRequired: asRequired, AsProvided: asProvided, mu, muMin, muMax, Mu: safe(Mu), check: check(pass, message) };
}

/** Uốn/cắt V1 follows the visible equations in Beam.xlsm/KiemTraUonCat. */
export function calcBeam(input: BeamInput): BeamResult {
  const concrete = getConcrete(input.concrete); const stirrupSteel = getSteel(input.stirrupSteel); const longitudinalSteel = getSteel(input.steel);
  const negative = calcFlexure(input.MNegative, input.b, input.h, input.aTop, input.AsTop, input.concrete, input.steel);
  const positive = calcFlexure(input.MPositive, input.b, input.h, input.aBottom, input.AsBottom, input.concrete, input.steel);
  const ho = input.h - Math.max(input.aTop, input.aBottom); const qDemand = Math.abs(input.Q);
  const stirrupArea = Math.PI * input.stirrupLegs * input.stirrupDia ** 2 / 4;
  const stirrupStrength = input.stirrupDia >= 10 ? longitudinalSteel.Rsw : stirrupSteel.Rsw;
  const qsw = input.stirrupSpacing > 0 ? stirrupStrength * stirrupArea / input.stirrupSpacing : 0;
  const qbt = safe(0.3 * concrete.Rb * input.b * ho / 1000); const qMin = safe(0.5 * concrete.Rbt * input.b * ho / 1000); const qMax = safe(2.5 * concrete.Rbt * input.b * ho / 1000);
  const qswMin = 0.25 * concrete.Rbt * input.b; const qBBase = safe(1.5 * concrete.Rbt * input.b * ho / 1000);
  const qB = Math.min(Math.max(qBBase, qMin), qMax) * (qsw < qswMin ? qsw / qswMin : 1); const qSw = safe(0.75 * qsw * ho / 1000); const qResistance = qB + qSw;
  const sMax = qDemand <= qMin ? Math.min(0.75 * ho, 500) : Math.min(0.5 * ho, 300);
  const compressionCheck = check(ho > 0 && qDemand <= qbt, qDemand <= qbt ? 'Đạt điều kiện Q ≤ Qbt' : 'Không đạt điều kiện Q ≤ Qbt');
  const resistanceCheck = check(ho > 0 && qDemand <= qResistance, qDemand <= qResistance ? 'Đạt điều kiện Q ≤ Qb + Qsw' : 'Không đạt điều kiện Q ≤ Qb + Qsw');
  const spacingCheck = check(input.stirrupSpacing > 0 && input.stirrupSpacing <= sMax, input.stirrupSpacing <= sMax ? 'Khoảng cách đai đạt' : 'Khoảng cách đai vượt giới hạn');
  const shearPass = compressionCheck.pass && resistanceCheck.pass && spacingCheck.pass; const warnings: string[] = [];
  if (!negative.check.pass) warnings.push(`M−: ${negative.check.message}`); if (!positive.check.pass) warnings.push(`M+: ${positive.check.message}`); if (!compressionCheck.pass) warnings.push(compressionCheck.message); if (!resistanceCheck.pass) warnings.push(resistanceCheck.message); if (!spacingCheck.pass) warnings.push(spacingCheck.message); if (input.stirrupDia <= 0 || input.stirrupLegs < 2) warnings.push('Cần nhập số nhánh và đường kính đai hợp lệ');
  return { negative, positive, shear: { ho, qDemand, qbt, qB, qSw, qResistance, qsw, stirrupArea, sMax, compressionCheck, resistanceCheck, spacingCheck, check: check(shearPass, shearPass ? 'Đạt cắt' : 'Không đạt cắt') }, pass: negative.check.pass && positive.check.pass && shearPass, warnings };
}

export const createDefaultBeam = (id: string = crypto.randomUUID()): BeamInput => ({ id, name: 'Dầm mới', b: 300, h: 600, aTop: 50, aBottom: 50, MNegative: 120, MPositive: 100, Q: 80, concrete: 'B25', steel: 'CB400-V', stirrupSteel: 'CB240-T', AsTop: 942, AsBottom: 942, stirrupLegs: 2, stirrupDia: 10, stirrupSpacing: 150 });
