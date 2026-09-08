/**
 * Móng đơn BTCT — bám MongDon.xlsm (Design_MongDon_ALL).
 *
 * Áp lực đáy:
 *   ΣN = FZ + Htn·γ'·Af   (khi Htn>0; nếu Htn=0 thì N dùng trực tiếp)
 *   ΣMx = MX − FY·Hf − FZ·ey ; ΣMy = MY + FX·Hf + FZ·ex
 *   p  = ΣN/Af ± |Mx|/Wx ± |My|/Wy + γ·Df + pg
 *
 * Rtc (áp lực tiêu chuẩn đất nền) — công thức MongDon:
 *   A,B,D theo φ; γb theo ZWT; Rtc=(m1·m2/k)·(A·b·γb + B·Df·γ' + D·c − γ·h0)
 *
 * Tham chiếu TCVN 5574:2018 (BTCT) + nền theo MongDon — không chứng nhận full compliance toàn mã.
 */
import { getConcrete, getSteel } from './materials';

export type FoundationInput = {
  id: string;
  name: string;
  Lx: number;
  Ly: number;
  Hf: number;
  Df: number;
  colB: number;
  colH: number;
  N: number;
  Mx: number;
  My: number;
  /** Lực ngang tại đỉnh cột/móng (kN) — quy đổi moment đáy */
  Fx?: number;
  Fy?: number;
  /** Lệch tâm cột so với tâm móng (m) */
  ex?: number;
  ey?: number;
  Rtc: number;
  concrete: string;
  steel: string;
  a: number;
  barsX?: string;
  barsY?: string;
  gammaFill?: number;
  pg?: number;
  Htn?: number;
  cx1?: number;
  cx2?: number;
  cy1?: number;
  cy2?: number;
  rtcMode?: 'manual' | 'calc';
  phi?: number;
  cII?: number;
  gammaII?: number;
  gammaPrime?: number;
  m1?: number;
  m2?: number;
  k?: number;
  zwt?: number;
  h0Basement?: number;
};

export type Check = { pass: boolean; message: string };

export type BearingFactors = {
  A: number;
  B: number;
  D: number;
  gammaB: number;
  rtcCalc: number;
};

export type FoundationResult = {
  Af: number;
  Wx: number;
  Wy: number;
  sigmaN: number;
  sigmaMx: number;
  sigmaMy: number;
  pAvg: number;
  pMax: number;
  pMin: number;
  rtcUsed: number;
  bearing?: BearingFactors;
  soilAvg: Check;
  soilMax: Check;
  soilMin: Check;
  punching: Check & { Nct: number; Nkt: number; um: number; Act: number; ho: number };
  flexureX: Check;
  flexureY: Check;
  AsXReq: number;
  AsXProv: number;
  AsYReq: number;
  AsYProv: number;
  AsXMin: number;
  AsYMin: number;
  pass: boolean;
  warnings: string[];
};

const check = (pass: boolean, message: string): Check => ({ pass, message });

export function parseFoundationBars(spec: string): { As: number; dia: number; spacing: number; ok: boolean } {
  const s = (spec || '').trim().toLowerCase().replace(/ø|ф/g, 'd').replace(/,/g, '.');
  const m = s.match(/d\s*([0-9]+(?:\.[0-9]+)?)\s*[a@x×]\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (!m) return { As: 0, dia: 0, spacing: 0, ok: false };
  const dia = Number(m[1]);
  const spacing = Number(m[2]);
  if (!(dia > 0 && spacing > 0)) return { As: 0, dia: 0, spacing: 0, ok: false };
  const As = (Math.PI * dia * dia) / 4 * (1000 / spacing);
  return { As: Math.round(As * 10) / 10, dia, spacing, ok: true };
}

export function bearingCapacityFactors(phiDeg: number): { A: number; B: number; D: number } {
  const phi = (Math.max(phiDeg, 0.1) * Math.PI) / 180;
  const cot = 1 / Math.tan(phi);
  const den = cot + phi - Math.PI / 2;
  if (Math.abs(den) < 1e-12) return { A: 0, B: 1, D: 0 };
  const A = Math.round((0.25 * Math.PI) / den * 1000) / 1000;
  const B = Math.round((1 + Math.PI / den) * 1000) / 1000;
  const D = Math.round((Math.PI * cot) / den * 1000) / 1000;
  return { A, B, D };
}

export function calcRtc(input: {
  Lx: number; Ly: number; Df: number; phi: number; cII: number;
  gammaII: number; gammaPrime: number; m1: number; m2: number; k: number;
  zwt: number; h0Basement: number;
}): BearingFactors {
  const { A, B, D } = bearingCapacityFactors(input.phi);
  const b = Math.min(Math.max(input.Lx, 0.1), Math.max(input.Ly, 0.1));
  let gammaB = input.gammaII;
  if (input.zwt > 0) {
    gammaB = input.Df > input.zwt ? input.gammaII - 10 : input.gammaII;
  }
  const inner =
    A * b * gammaB +
    B * input.Df * input.gammaPrime +
    D * input.cII -
    input.gammaII * input.h0Basement;
  const factor = (input.m1 * input.m2) / Math.max(input.k, 1e-6);
  const rtcCalc = factor * inner;
  return { A, B, D, gammaB, rtcCalc };
}

export function calcFoundation(input: FoundationInput): FoundationResult {
  const warnings: string[] = [];
  const Lx = Math.max(input.Lx, 0.1);
  const Ly = Math.max(input.Ly, 0.1);
  const Hf = Math.max(input.Hf, 0.1);
  const Df = Math.max(input.Df, 0);
  const colB = Math.max(input.colB, 0.1);
  const colH = Math.max(input.colH, 0.1);
  const a_mm = input.a > 0 ? input.a : 50;
  const gammaFill = input.gammaFill ?? 20;
  const gammaPrime = input.gammaPrime ?? gammaFill;
  const pg = input.pg ?? 0;
  const Htn = Math.max(input.Htn ?? 0, 0);
  const Fx = input.Fx ?? 0;
  const Fy = input.Fy ?? 0;
  const ex = input.ex ?? 0;
  const ey = input.ey ?? 0;

  const concrete = getConcrete(input.concrete);
  const steel = getSteel(input.steel);
  const Rbt = concrete.Rbt;
  const Rs = steel.Rs;

  const Af = Lx * Ly;
  const Wx = (Lx * Ly * Ly) / 6;
  const Wy = (Ly * Lx * Lx) / 6;

  const Fz = input.N;
  const sigmaN = Htn > 0 ? Fz + Htn * gammaPrime * Af : Fz;

  // ΣMx = MX − FY·Hf − FZ·ey ; ΣMy = MY + FX·Hf + FZ·ex  (MongDon AM/AN)
  const sigmaMx = Math.abs(input.Mx - Fy * Hf - Fz * ey);
  const sigmaMy = Math.abs(input.My + Fx * Hf + Fz * ex);

  const selfW = gammaFill * Df + pg;
  const pAvg = sigmaN / Af + selfW;
  const pMax = sigmaN / Af + sigmaMx / Wx + sigmaMy / Wy + selfW;
  const pMin = sigmaN / Af - sigmaMx / Wx - sigmaMy / Wy + selfW;

  const rtcMode = input.rtcMode ?? 'manual';
  let bearing: BearingFactors | undefined;
  let rtcUsed = Math.max(input.Rtc, 1);
  if (rtcMode === 'calc') {
    bearing = calcRtc({
      Lx, Ly, Df,
      phi: input.phi ?? 12,
      cII: input.cII ?? 19.5,
      gammaII: input.gammaII ?? 19.1,
      gammaPrime,
      m1: input.m1 ?? 1.1,
      m2: input.m2 ?? 1,
      k: input.k ?? 1.1,
      zwt: input.zwt ?? 1,
      h0Basement: input.h0Basement ?? 0,
    });
    rtcUsed = Math.max(bearing.rtcCalc, 1);
  }

  const soilAvg = check(
    pAvg <= rtcUsed + 1e-6,
    `p_tb=${pAvg.toFixed(1)} ${pAvg <= rtcUsed ? '≤' : '>'} Rtc=${rtcUsed.toFixed(1)}`
  );
  const soilMax = check(
    pMax <= 1.2 * rtcUsed + 1e-6,
    `p_max=${pMax.toFixed(1)} ${pMax <= 1.2 * rtcUsed ? '≤' : '>'} 1.2Rtc=${(1.2 * rtcUsed).toFixed(1)}`
  );
  const soilMin = check(pMin >= -1e-6, `p_min=${pMin.toFixed(1)} ${pMin >= 0 ? '≥' : '<'} 0 (không nhổ)`);

  const ho = Math.max(Hf - a_mm / 1000, 0.05);

  const cx1 = input.cx1 != null ? Math.max(input.cx1, 0) : Math.max((Lx - colB) / 2, 0);
  const cx2 = input.cx2 != null ? Math.max(input.cx2, 0) : cx1;
  const cy1 = input.cy1 != null ? Math.max(input.cy1, 0) : Math.max((Ly - colH) / 2, 0);
  const cy2 = input.cy2 != null ? Math.max(input.cy2, 0) : cy1;

  const mcx1 = Math.min(cx1, ho);
  const mcx2 = Math.min(cx2, ho);
  const mcy1 = Math.min(cy1, ho);
  const mcy2 = Math.min(cy2, ho);
  const um = 2 * colB + 2 * colH + mcx1 + mcx2 + mcy1 + mcy2;
  const towerLx = colB + mcx1 + mcx2;
  const towerLy = colH + mcy1 + mcy2;
  const Act = Math.max(Af - towerLx * towerLy, 0);

  const Nct = Math.max(pMax, 0) * Act;
  const Nkt = 0.75 * Rbt * um * ho * 1000;
  const punchingPass = Nct <= Nkt + 1e-3;
  const punching = {
    ...check(punchingPass, `Nct=${Nct.toFixed(1)} ${punchingPass ? '≤' : '>'} Nkt=${Nkt.toFixed(1)} kN`),
    Nct, Nkt, um, Act, ho,
  };

  const MxConsole = (Math.max(pMax, 0) * Math.max(cx1, cx2) ** 2) / 2;
  const MyConsole = (Math.max(pMax, 0) * Math.max(cy1, cy2) ** 2) / 2;
  const zeta = 0.9;
  const AsXFromM = Rs > 0 && ho > 0 ? (MxConsole * 1e6) / (Rs * zeta * ho * 1000) : 0;
  const AsYFromM = Rs > 0 && ho > 0 ? (MyConsole * 1e6) / (Rs * zeta * ho * 1000) : 0;
  const AsMin = 0.001 * 1000 * (ho * 1000);
  const AsXReq = Math.max(AsXFromM, AsMin);
  const AsYReq = Math.max(AsYFromM, AsMin);

  const px = parseFoundationBars(input.barsX ?? '');
  const py = parseFoundationBars(input.barsY ?? '');
  const AsXProv = px.ok ? px.As : 0;
  const AsYProv = py.ok ? py.As : 0;

  if (!px.ok) warnings.push('Chưa nhập thép phương X hợp lệ (vd d12a150).');
  if (!py.ok) warnings.push('Chưa nhập thép phương Y hợp lệ (vd d12a150).');
  if (Math.max(cx1, cx2) < 0.05) warnings.push('Console X rất nhỏ — kiểm tra kích thước móng/cột.');
  if (pMin < 0) warnings.push('p_min < 0: có nguy cơ nhổ góc móng.');
  if (Htn > 0) warnings.push(`ΣN = FZ(${Fz.toFixed(1)}) + Htn·γ'·Af = ${sigmaN.toFixed(1)} kN`);
  if (Fx !== 0 || Fy !== 0 || ex !== 0 || ey !== 0) {
    warnings.push(
      `ΣM đáy: Mx=${sigmaMx.toFixed(2)} (MX−FY·Hf−FZ·ey), My=${sigmaMy.toFixed(2)} (MY+FX·Hf+FZ·ex)`
    );
  }

  const flexureX = check(
    AsXProv + 1e-6 >= AsXReq,
    `Asx bố trí ${AsXProv.toFixed(0)} ${AsXProv >= AsXReq ? '≥' : '<'} yc ${AsXReq.toFixed(0)} mm²/m`
  );
  const flexureY = check(
    AsYProv + 1e-6 >= AsYReq,
    `Asy bố trí ${AsYProv.toFixed(0)} ${AsYProv >= AsYReq ? '≥' : '<'} yc ${AsYReq.toFixed(0)} mm²/m`
  );

  const pass =
    soilAvg.pass && soilMax.pass && soilMin.pass && punching.pass && flexureX.pass && flexureY.pass;

  return {
    Af, Wx, Wy, sigmaN, sigmaMx, sigmaMy, pAvg, pMax, pMin, rtcUsed, bearing,
    soilAvg, soilMax, soilMin, punching, flexureX, flexureY,
    AsXReq, AsXProv, AsYReq, AsYProv, AsXMin: AsMin, AsYMin: AsMin,
    pass, warnings,
  };
}

export const createDefaultFoundation = (id: string = crypto.randomUUID()): FoundationInput => ({
  id, name: 'Móng 1', Lx: 2.0, Ly: 2.0, Hf: 0.5, Df: 1.5, colB: 0.4, colH: 0.4,
  N: 800, Mx: 50, My: 40, Fx: 0, Fy: 0, ex: 0, ey: 0, Rtc: 200,
  concrete: 'B25', steel: 'CB400-V', a: 50, barsX: 'd12a150', barsY: 'd12a150',
  gammaFill: 20, pg: 0, Htn: 0, rtcMode: 'manual',
  phi: 12, cII: 19.5, gammaII: 19.1, gammaPrime: 20, m1: 1.1, m2: 1, k: 1.1, zwt: 1, h0Basement: 0,
});
