/**
 * Simplified deflection check (TCVN 5574:2018 style).
 * Full curvature integration needs moment diagram along span.
 * This module provides approximate mid-span deflection.
 * Units: mm, MPa, kN.m, m for L
 */
import { getConcrete, getSteel, EB1_RED_SHORT, type Humidity } from './materials';
import { calcCrack, type CrackInput } from './crack';

export type DeflectionInput = CrackInput & {
  /** Span length (m) */
  L: number;
  support?: 'simple' | 'continuous' | 'cantilever';
  limitRatio?: number;
};

export type DeflectionResult = {
  Mcrc: number;
  cracked: boolean;
  EIshort: number;
  EIlong: number;
  deltaShort: number;
  deltaLong: number;
  limit: number;
  limitRatio: number;
  checkShort: { pass: boolean; message: string };
  checkLong: { pass: boolean; message: string };
  pass: boolean;
  warnings: string[];
};

export function calcDeflection(input: DeflectionInput): DeflectionResult {
  const c = getConcrete(input.concrete);
  const s = getSteel(input.steel);
  const humidity: Humidity = input.humidity ?? 'mid';
  const phiB = c.phiB[humidity];
  const Lmm = input.L * 1000;
  const limitRatio = input.limitRatio ?? 250;
  const limit = Lmm / limitRatio;

  const crack = calcCrack(input);
  const Mshort = Math.abs(input.Mshort);
  const Mlong = Math.abs(input.Mlong);

  let EIshort: number;
  let EIlong: number;

  if (!crack.cracked) {
    EIshort = c.Eb * crack.Ired1;
    EIlong = (c.Eb / (1 + phiB)) * crack.Ired1;
  } else {
    const alphaShort = (EB1_RED_SHORT * s.Es) / c.RbSer;
    EIshort = (s.Es / alphaShort) * crack.Ired2 * 0.8;
    EIlong = EIshort / (1 + 0.8 * phiB);
  }

  let k = 5 / 48;
  if (input.support === 'continuous') k = 1 / 16;
  if (input.support === 'cantilever') k = 1 / 2;

  const deltaFrom = (M: number, EI: number) => {
    if (EI <= 0 || Lmm <= 0) return 0;
    const M_Nmm = M * 1e6;
    return (k * M_Nmm * Lmm ** 2) / EI;
  };

  const deltaShort = deltaFrom(Mshort, EIshort);
  const deltaLong = deltaFrom(Mlong, EIlong);

  const checkShort = {
    pass: deltaShort <= limit,
    message:
      deltaShort <= limit
        ? `δ ngắn hạn ≈ ${deltaShort.toFixed(1)} ≤ L/${limitRatio} = ${limit.toFixed(1)} mm`
        : `δ ngắn hạn ≈ ${deltaShort.toFixed(1)} > L/${limitRatio} = ${limit.toFixed(1)} mm`,
  };
  const checkLong = {
    pass: deltaLong <= limit,
    message:
      deltaLong <= limit
        ? `δ dài hạn ≈ ${deltaLong.toFixed(1)} ≤ L/${limitRatio} = ${limit.toFixed(1)} mm`
        : `δ dài hạn ≈ ${deltaLong.toFixed(1)} > L/${limitRatio} = ${limit.toFixed(1)} mm`,
  };

  const warnings: string[] = [];
  if (input.L <= 0) warnings.push('Cần nhập chiều dài nhịp L để kiểm tra võng');
  if (Mshort <= 0 && Mlong <= 0) warnings.push('Chưa nhập moment sử dụng cho võng');
  warnings.push('Võng là ước lượng đơn giản (chưa tích phân độ cong đầy đủ theo sơ đồ moment)');

  return {
    Mcrc: crack.Mcrc,
    cracked: crack.cracked,
    EIshort,
    EIlong,
    deltaShort,
    deltaLong,
    limit,
    limitRatio,
    checkShort,
    checkLong,
    pass: checkShort.pass && checkLong.pass && input.L > 0,
    warnings,
  };
}
