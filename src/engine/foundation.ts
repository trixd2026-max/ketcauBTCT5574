/**
 * Móng đơn BTCT — bám MongDon.xlsm (Design_MongDon_ALL):
 * p_tb / p_max / p_min, chọc thủng Nct/Nkt, uốn console As.
 * Chưa khẳng định tuân thủ đầy đủ TCVN 5574:2018.
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
  Rtc: number;
  concrete: string;
  steel: string;
  a: number;
  barsX?: string;
  barsY?: string;
  gammaFill?: number;
  pg?: number;
};

export type Check = { pass: boolean; message: string };

export type FoundationResult = {
  Af: number;
  Wx: number;
  Wy: number;
  pAvg: number;
  pMax: number;
  pMin: number;
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

export function calcFoundation(input: FoundationInput): FoundationResult {
  const warnings: string[] = [];
  const Lx = Math.max(input.Lx, 0.1);
  const Ly = Math.max(input.Ly, 0.1);
  const Hf = Math.max(input.Hf, 0.1);
  const Df = Math.max(input.Df, 0);
  const colB = Math.max(input.colB, 0.1);
  const colH = Math.max(input.colH, 0.1);
  const N = input.N;
  const Mx = Math.abs(input.Mx);
  const My = Math.abs(input.My);
  const Rtc = Math.max(input.Rtc, 1);
  const a_mm = input.a > 0 ? input.a : 50;
  const gamma = input.gammaFill ?? 20;
  const pg = input.pg ?? 0;

  const concrete = getConcrete(input.concrete);
  const steel = getSteel(input.steel);
  const Rbt = concrete.Rbt;
  const Rs = steel.Rs;

  const Af = Lx * Ly;
  const Wx = (Lx * Ly * Ly) / 6;
  const Wy = (Ly * Lx * Lx) / 6;

  const selfW = gamma * Df + pg;
  const pAvg = N / Af + selfW;
  const pMax = N / Af + Mx / Wx + My / Wy + selfW;
  const pMin = N / Af - Mx / Wx - My / Wy + selfW;

  const soilAvg = check(pAvg <= Rtc + 1e-6, `p_tb=${pAvg.toFixed(1)} ${pAvg <= Rtc ? '≤' : '>'} Rtc=${Rtc}`);
  const soilMax = check(pMax <= 1.2 * Rtc + 1e-6, `p_max=${pMax.toFixed(1)} ${pMax <= 1.2 * Rtc ? '≤' : '>'} 1.2Rtc=${(1.2 * Rtc).toFixed(1)}`);
  const soilMin = check(pMin >= -1e-6, `p_min=${pMin.toFixed(1)} ${pMin >= 0 ? '≥' : '<'} 0 (không nhổ)`);

  const ho = Math.max(Hf - a_mm / 1000, 0.05);

  const cx1 = Math.max((Lx - colB) / 2, 0);
  const cy1 = Math.max((Ly - colH) / 2, 0);

  const dx = Math.min(cx1, ho);
  const dy = Math.min(cy1, ho);
  const um = 2 * (colB + dx) + 2 * (colH + dy);
  const towerLx = colB + 2 * dx;
  const towerLy = colH + 2 * dy;
  const Act = Math.max(Af - towerLx * towerLy, 0);

  const Nct = Math.max(pMax, 0) * Act;
  const Nkt = 0.75 * Rbt * um * ho * 1000;
  const punchingPass = Nct <= Nkt + 1e-3;
  const punching = {
    ...check(punchingPass, `Nct=${Nct.toFixed(1)} ${punchingPass ? '≤' : '>'} Nkt=${Nkt.toFixed(1)} kN`),
    Nct,
    Nkt,
    um,
    Act,
    ho,
  };

  const MxConsole = Math.max(pMax, 0) * (cx1 * cx1) / 2;
  const MyConsole = Math.max(pMax, 0) * (cy1 * cy1) / 2;

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
  if (cx1 < 0.05) warnings.push('Console X rất nhỏ — kiểm tra kích thước móng/cột.');
  if (pMin < 0) warnings.push('p_min < 0: có nguy cơ nhổ góc móng — cần xem xét tổ hợp / tăng kích thước.');

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
    Af, Wx, Wy, pAvg, pMax, pMin,
    soilAvg, soilMax, soilMin, punching, flexureX, flexureY,
    AsXReq, AsXProv, AsYReq, AsYProv, AsXMin: AsMin, AsYMin: AsMin,
    pass, warnings,
  };
}

export const createDefaultFoundation = (id: string = crypto.randomUUID()): FoundationInput => ({
  id,
  name: 'Móng 1',
  Lx: 2.0,
  Ly: 2.0,
  Hf: 0.5,
  Df: 1.5,
  colB: 0.4,
  colH: 0.4,
  N: 800,
  Mx: 50,
  My: 40,
  Rtc: 200,
  concrete: 'B25',
  steel: 'CB400-V',
  a: 50,
  barsX: 'd12a150',
  barsY: 'd12a150',
  gammaFill: 20,
  pg: 0,
});
