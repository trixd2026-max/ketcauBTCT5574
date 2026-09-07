import { getConcrete, getSteel, type Humidity } from './materials';
import { calcCrack, type CrackResult } from './crack';
import { calcDeflection, type DeflectionResult } from './deflection';

export type BeamInput = {
  id: string; name: string; b: number; h: number; aTop: number; aBottom: number;
  MNegative: number; MPositive: number; Q: number; concrete: string; steel: string; stirrupSteel: string;
  AsTop: number; AsBottom: number; stirrupLegs: number; stirrupDia: number; stirrupSpacing: number;
  nBarsTop?: number; nBarsBottom?: number; barDiaTop?: number; barDiaBottom?: number;
  MserShortNeg?: number; MserShortPos?: number;
  MserLongNeg?: number; MserLongPos?: number;
  L?: number;
  humidity?: Humidity;
  support?: 'simple' | 'continuous' | 'cantilever';
  limitRatio?: number;
};

export type Check = { pass: boolean; message: string };

export type FlexureResult = {
  ho: number; alphaM: number; xi: number; xiR: number;
  AsRequired: number; AsProvided: number; mu: number; muMin: number; muMax: number;
  Mu: number; check: Check;
};

export type DetailingResult = {
  coverTop: Check; coverBottom: Check;
  minBarsTop: Check; minBarsBottom: Check;
  spacingTop: Check; spacingBottom: Check;
  stirrupRules: Check;
  checks: Check[];
  pass: boolean;
};

export type BeamResult = {
  negative: FlexureResult;
  positive: FlexureResult;
  shear: {
    ho: number; qDemand: number; qbt: number; qB: number; qSw: number;
    qResistance: number; qsw: number; stirrupArea: number; sMax: number;
    compressionCheck: Check; resistanceCheck: Check; spacingCheck: Check; check: Check;
  };
  detailing: DetailingResult;
  crack: CrackResult;
  deflection: DeflectionResult;
  pass: boolean;
  warnings: string[];
};

const round = (value: number, decimals: number) => Number(value.toFixed(decimals));
const safe = (value: number) => (Number.isFinite(value) ? value : 0);
const check = (pass: boolean, message: string): Check => ({ pass, message });

function calcFlexure(
  moment: number, b: number, h: number, a: number, asProvided: number,
  concreteName: string, steelName: string
): FlexureResult {
  const concrete = getConcrete(concreteName);
  const steel = getSteel(steelName);
  const ho = h - a;
  const alphaM = ho > 0 && b > 0 ? Math.abs(moment) * 1e6 / (b * ho ** 2 * concrete.Rb) : Infinity;
  const xi = alphaM >= 0.5 ? 1 : round(1 - Math.sqrt(Math.max(0, 1 - 2 * alphaM)), 3);
  const xiR = 0.8 / (1 + (steel.Rs / steel.Es) / 0.0035);
  const asRequired = safe(concrete.Rb * b * xi * ho / steel.Rs);
  const mu = ho > 0 && b > 0 ? (asProvided * 100) / (b * ho) : 0;
  const muMin = 0.1;
  const muMax = (xiR * 100 * concrete.Rb) / steel.Rs;
  const Mu = (concrete.Rb * b * xiR * ho ** 2 * (1 - 0.5 * xiR)) / 1e6;
  const pass =
    ho > 0 && alphaM <= 0.5 && xi <= xiR && asProvided >= asRequired && mu >= muMin && mu <= muMax;
  let message = 'Đạt uốn';
  if (ho <= 0) message = 'a phải nhỏ hơn h';
  else if (alphaM > 0.5 || xi > xiR) message = 'Tiết diện vượt giới hạn vùng nén';
  else if (asProvided < asRequired) message = 'Thiếu cốt thép chịu kéo';
  else if (mu < muMin) message = 'Hàm lượng thép nhỏ hơn tối thiểu';
  else if (mu > muMax) message = 'Hàm lượng thép lớn hơn tối đa';
  return {
    ho, alphaM: safe(alphaM), xi, xiR, AsRequired: asRequired, AsProvided: asProvided,
    mu, muMin, muMax, Mu: safe(Mu), check: check(pass, message),
  };
}

function calcDetailing(input: BeamInput): DetailingResult {
  const minCover = 25;
  const coverTopOk = input.aTop >= minCover;
  const coverBottomOk = input.aBottom >= minCover;
  const coverTop = check(coverTopOk, coverTopOk ? `Lớp bảo vệ trên ≥ ${minCover} mm` : `Lớp bảo vệ trên < ${minCover} mm (cần ≥ ${minCover} mm)`);
  const coverBottom = check(coverBottomOk, coverBottomOk ? `Lớp bảo vệ dưới ≥ ${minCover} mm` : `Lớp bảo vệ dưới < ${minCover} mm (cần ≥ ${minCover} mm)`);

  const estDia = (as: number) => (as > 1200 ? 20 : as > 600 ? 16 : 12);
  const estN = (as: number, d: number) => Math.max(2, Math.round(as / ((Math.PI * d * d) / 4)));

  const dTop = input.barDiaTop ?? estDia(input.AsTop);
  const dBot = input.barDiaBottom ?? estDia(input.AsBottom);
  const nTop = input.nBarsTop ?? estN(input.AsTop, dTop);
  const nBot = input.nBarsBottom ?? estN(input.AsBottom, dBot);

  const minBarsTop = check(nTop >= 2, nTop >= 2 ? `Số thanh trên ≥ 2` : `Cần ít nhất 2 thanh thép trên`);
  const minBarsBottom = check(nBot >= 2, nBot >= 2 ? `Số thanh dưới ≥ 2` : `Cần ít nhất 2 thanh thép dưới`);

  const clearMin = 25;
  const spacingTop = nTop > 1 ? (input.b - 2 * input.aTop - nTop * dTop) / (nTop - 1) : 999;
  const spacingBot = nBot > 1 ? (input.b - 2 * input.aBottom - nBot * dBot) / (nBot - 1) : 999;
  const spacingTopC = check(spacingTop >= clearMin || nTop <= 1, spacingTop >= clearMin || nTop <= 1 ? `Khoảng cách thép trên đạt` : `Khoảng cách thép trên quá nhỏ (~${Math.round(spacingTop)} mm)`);
  const spacingBottomC = check(spacingBot >= clearMin || nBot <= 1, spacingBot >= clearMin || nBot <= 1 ? `Khoảng cách thép dưới đạt` : `Khoảng cách thép dưới quá nhỏ (~${Math.round(spacingBot)} mm)`);

  const stirrupOk = input.stirrupLegs >= 2 && input.stirrupDia >= 6;
  const stirrupRules = check(stirrupOk, stirrupOk ? 'Đai hợp lệ (≥2 nhánh, Ø≥6)' : 'Đai cần ≥2 nhánh và Ø≥6 mm');

  const checks = [coverTop, coverBottom, minBarsTop, minBarsBottom, spacingTopC, spacingBottomC, stirrupRules];
  return { coverTop, coverBottom, minBarsTop, minBarsBottom, spacingTop: spacingTopC, spacingBottom: spacingBottomC, stirrupRules, checks, pass: checks.every((c) => c.pass) };
}

export function calcBeam(input: BeamInput): BeamResult {
  const concrete = getConcrete(input.concrete);
  const stirrupSteel = getSteel(input.stirrupSteel);
  const longitudinalSteel = getSteel(input.steel);

  const negative = calcFlexure(input.MNegative, input.b, input.h, input.aTop, input.AsTop, input.concrete, input.steel);
  const positive = calcFlexure(input.MPositive, input.b, input.h, input.aBottom, input.AsBottom, input.concrete, input.steel);

  const ho = input.h - Math.max(input.aTop, input.aBottom);
  const qDemand = Math.abs(input.Q);
  const stirrupArea = (Math.PI * input.stirrupLegs * input.stirrupDia ** 2) / 4;
  const stirrupStrength = input.stirrupDia >= 10 ? longitudinalSteel.Rsw : stirrupSteel.Rsw;
  const qsw = input.stirrupSpacing > 0 ? (stirrupStrength * stirrupArea) / input.stirrupSpacing : 0;
  const qbt = safe((0.3 * concrete.Rb * input.b * ho) / 1000);
  const qMin = safe((0.5 * concrete.Rbt * input.b * ho) / 1000);
  const qMax = safe((2.5 * concrete.Rbt * input.b * ho) / 1000);
  const qswMin = 0.25 * concrete.Rbt * input.b;
  const qBBase = safe((1.5 * concrete.Rbt * input.b * ho) / 1000);
  const qB = Math.min(Math.max(qBBase, qMin), qMax) * (qsw < qswMin ? qsw / qswMin : 1);
  const qSw = safe((0.75 * qsw * ho) / 1000);
  const qResistance = qB + qSw;
  const sMax = qDemand <= qMin ? Math.min(0.75 * ho, 500) : Math.min(0.5 * ho, 300);

  const compressionCheck = check(ho > 0 && qDemand <= qbt, qDemand <= qbt ? 'Đạt điều kiện Q ≤ Qbt' : 'Không đạt điều kiện Q ≤ Qbt');
  const resistanceCheck = check(ho > 0 && qDemand <= qResistance, qDemand <= qResistance ? 'Đạt điều kiện Q ≤ Qb + Qsw' : 'Không đạt điều kiện Q ≤ Qb + Qsw');
  const spacingCheck = check(input.stirrupSpacing > 0 && input.stirrupSpacing <= sMax, input.stirrupSpacing <= sMax ? 'Khoảng cách đai đạt' : 'Khoảng cách đai vượt giới hạn');
  const shearPass = compressionCheck.pass && resistanceCheck.pass && spacingCheck.pass;

  const detailing = calcDetailing(input);

  const factor = 1.4;
  const MserShortNeg = input.MserShortNeg ?? Math.abs(input.MNegative) / factor;
  const MserShortPos = input.MserShortPos ?? Math.abs(input.MPositive) / factor;
  const MserLongNeg = input.MserLongNeg ?? MserShortNeg * 0.7;
  const MserLongPos = input.MserLongPos ?? MserShortPos * 0.7;

  const useNeg = Math.abs(MserShortNeg) >= Math.abs(MserShortPos);
  const crackInput = {
    b: input.b,
    h: input.h,
    a: useNeg ? input.aTop : input.aBottom,
    aPrime: useNeg ? input.aBottom : input.aTop,
    As: useNeg ? input.AsTop : input.AsBottom,
    AsPrime: useNeg ? input.AsBottom : input.AsTop,
    ds: useNeg ? (input.barDiaTop ?? 16) : (input.barDiaBottom ?? 16),
    concrete: input.concrete,
    steel: input.steel,
    Mshort: useNeg ? MserShortNeg : MserShortPos,
    Mlong: useNeg ? MserLongNeg : MserLongPos,
    humidity: input.humidity ?? 'mid' as const,
  };
  const crack = calcCrack(crackInput);
  const deflection = calcDeflection({
    ...crackInput,
    L: input.L ?? 0,
    support: input.support ?? 'simple',
    limitRatio: input.limitRatio ?? 250,
  });

  const warnings: string[] = [];
  if (!negative.check.pass) warnings.push(`M−: ${negative.check.message}`);
  if (!positive.check.pass) warnings.push(`M+: ${positive.check.message}`);
  if (!compressionCheck.pass) warnings.push(compressionCheck.message);
  if (!resistanceCheck.pass) warnings.push(resistanceCheck.message);
  if (!spacingCheck.pass) warnings.push(spacingCheck.message);
  if (input.stirrupDia <= 0 || input.stirrupLegs < 2) warnings.push('Cần nhập số nhánh và đường kính đai hợp lệ');
  detailing.checks.filter((c) => !c.pass).forEach((c) => warnings.push(c.message));
  if (!crack.pass) {
    if (!crack.checkShort.pass) warnings.push(`Nứt: ${crack.checkShort.message}`);
    if (!crack.checkLong.pass) warnings.push(`Nứt: ${crack.checkLong.message}`);
  }
  crack.warnings.forEach((w) => warnings.push(w));
  if (!deflection.pass && (input.L ?? 0) > 0) {
    if (!deflection.checkShort.pass) warnings.push(`Võng: ${deflection.checkShort.message}`);
    if (!deflection.checkLong.pass) warnings.push(`Võng: ${deflection.checkLong.message}`);
  }
  deflection.warnings.forEach((w) => warnings.push(w));

  const pass =
    negative.check.pass &&
    positive.check.pass &&
    shearPass &&
    detailing.pass &&
    crack.pass &&
    ((input.L ?? 0) <= 0 || deflection.pass);

  return {
    negative,
    positive,
    shear: {
      ho, qDemand, qbt, qB, qSw, qResistance, qsw, stirrupArea, sMax,
      compressionCheck, resistanceCheck, spacingCheck,
      check: check(shearPass, shearPass ? 'Đạt cắt' : 'Không đạt cắt'),
    },
    detailing,
    crack,
    deflection,
    pass,
    warnings,
  };
}

export const createDefaultBeam = (id: string = crypto.randomUUID()): BeamInput => ({
  id,
  name: 'Dầm mới',
  b: 300,
  h: 600,
  aTop: 50,
  aBottom: 50,
  MNegative: 120,
  MPositive: 100,
  Q: 80,
  concrete: 'B25',
  steel: 'CB400-V',
  stirrupSteel: 'CB240-T',
  AsTop: 942,
  AsBottom: 942,
  stirrupLegs: 2,
  stirrupDia: 10,
  stirrupSpacing: 150,
  L: 6,
  humidity: 'mid',
  support: 'simple',
});
