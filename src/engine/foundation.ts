/**
 * Móng đơn BTCT V1.0 — aligned with MongDon.xlsm (ThuyetMinh)
 * Soil: p_avg / p_max / p_min vs Rtc
 * RC: cantilever flexure Asx/Asy, punching Nct ≤ Nkt
 * Units: m for geometry, kN, kNm, kN/m²; steel mm²/m
 * Not TCVN-locked until golden cases fully verified.
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
  ex?: number;
  ey?: number;
  N: number;
  Mx: number;
  My: number;
  Qx?: number;
  Qy?: number;
  Ntc?: number;
  Mxtc?: number;
  Mytc?: number;
  concrete: string;
  steel: string;
  a: number;
  Rtc: number;
  gammaSoil?: number;
  htn?: number;
  pg?: number;
  barsX?: string;
  barsY?: string;
};

export type Check = { pass: boolean; message: string };

export type FoundationResult = {
  Af: number;
  Wx: number;
  Wy: number;
  Nbase: number;
  MxBase: number;
  MyBase: number;
  pAvg: number;
  pMax: number;
  pMin: number;
  eccX: number;
  eccY: number;
  soilAvg: Check;
  soilMax: Check;
  soilMin: Check;
  punching: Check & { Nct: number; Nkt: number; um: number };
  AsXReq: number;
  AsYReq: number;
  AsXMin: number;
  AsYMin: number;
  AsXProv: number;
  AsYProv: number;
  flexureX: Check;
  flexureY: Check;
  pass: boolean;
  warnings: string[];
};

const safe = (v: number) => (Number.isFinite(v) ? v : 0);
const check = (pass: boolean, message: string): Check => ({ pass, message });

export function parseFoundationBars(spec: string, widthMm = 1000): { As: number; dia: number; ok: boolean } {
  const s = (spec || '').trim().toLowerCase().replace(/ø|ф/g, 'd');
  if (!s) return { As: 0, dia: 0, ok: false };
  let m = s.match(/d\s*([0-9]+(?:\.[0-9]+)?)\s*[a@]\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (m) {
    const dia = Number(m[1]);
    const spacing = Number(m[2]);
    if (dia && spacing) {
      const As = ((Math.PI * dia * dia) / 4) * (widthMm / spacing);
      return { As: Math.round(As * 10) / 10, dia, ok: true };
    }
  }
  m = s.match(/([0-9]+)\s*d\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (m) {
    const n = Number(m[1]);
    const dia = Number(m[2]);
    const As = (n * Math.PI * dia * dia) / 4;
    return { As: Math.round(As * 10) / 10, dia, ok: true };
  }
  return { As: 0, dia: 0, ok: false };
}

export function calcFoundation(input: FoundationInput): FoundationResult {
  const c = getConcrete(input.concrete);
  const s = getSteel(input.steel);
  const Lx = Math.max(input.Lx, 0.1);
  const Ly = Math.max(input.Ly, 0.1);
  const Hf = Math.max(input.Hf, 0.1);
  const Df = Math.max(input.Df ?? 0, 0);
  const colB = Math.max(input.colB, 0.05);
  const colH = Math.max(input.colH, 0.05);
  const gamma = input.gammaSoil ?? 18;
  const htn = input.htn ?? 0;
  const pg = input.pg ?? 0;
  const a_m = (input.a || 50) / 1000;
  const h0 = Math.max(Hf - a_m, 0.05);

  const Af = Lx * Ly;
  const Wx = (1 / 6) * Lx * Ly * Ly;
  const Wy = (1 / 6) * Ly * Lx * Lx;

  const Nfill = gamma * htn * Af;
  const Nuls = Math.abs(input.N) + Nfill;
  const Qx = input.Qx ?? 0;
  const Qy = input.Qy ?? 0;
  const ey = input.ey ?? 0;
  const ex = input.ex ?? 0;
  const MxBase = input.Mx - Qy * Hf - Math.abs(input.N) * ey;
  const MyBase = input.My + Qx * Hf + Math.abs(input.N) * ex;

  const Ntc = input.Ntc != null && input.Ntc > 0 ? input.Ntc + Nfill : Nuls / 1.2;
  const Mxtc = input.Mxtc != null ? input.Mxtc : MxBase / 1.2;
  const Mytc = input.Mytc != null ? input.Mytc : MyBase / 1.2;

  const surcharge = gamma * Df + pg;
  const pAvg = Ntc / Af + surcharge;
  const pMax = Ntc / Af + Math.abs(Mxtc) / Wx + Math.abs(Mytc) / Wy + surcharge;
  const pMin = Ntc / Af - Math.abs(Mxtc) / Wx - Math.abs(Mytc) / Wy + surcharge;

  const Rtc = Math.max(input.Rtc, 1);
  const soilAvg = check(pAvg <= Rtc + 1e-6, pAvg <= Rtc ? `p_tb=${pAvg.toFixed(1)} ≤ Rtc=${Rtc}` : `p_tb=${pAvg.toFixed(1)} > Rtc=${Rtc}`);
  const soilMax = check(pMax <= 1.2 * Rtc + 1e-6, pMax <= 1.2 * Rtc ? `p_max=${pMax.toFixed(1)} ≤ 1.2Rtc=${(1.2 * Rtc).toFixed(1)}` : `p_max=${pMax.toFixed(1)} > 1.2Rtc`);
  const soilMin = check(pMin >= -1e-3, pMin >= 0 ? `p_min=${pMin.toFixed(1)} ≥ 0 (không nhổ)` : `p_min=${pMin.toFixed(1)} < 0 — có nhổ nền`);

  const eccX = Ntc > 1e-6 ? Math.abs(Mytc) / Ntc : 0;
  const eccY = Ntc > 1e-6 ? Math.abs(Mxtc) / Ntc : 0;

  const cx1 = Lx / 2 - colB / 2 + ex;
  const cy1 = Ly / 2 - colH / 2 + ey;
  const cx2 = Lx - cx1 - colB;
  const cy2 = Ly - cy1 - colH;
  const um =
    (2 * colB +
      2 * colH +
      2 * (Math.min(Math.max(cx1, 0), h0) + colB + Math.min(Math.max(cx2, 0), h0)) +
      2 * (Math.min(Math.max(cy1, 0), h0) + colH + Math.min(Math.max(cy2, 0), h0))) /
    2;
  const sideX = Math.min(Math.max(cx1, 0), h0) + colB + Math.min(Math.max(cx2, 0), h0);
  const sideY = Math.min(Math.max(cy1, 0), h0) + colH + Math.min(Math.max(cy2, 0), h0);
  const Act = Math.max(Af - sideX * sideY, 0);
  const pUls = Nuls / Af + Math.abs(MxBase) / Wx + Math.abs(MyBase) / Wy + surcharge;
  const Nct = pUls * Act;
  const Nkt = 0.75 * c.Rbt * um * h0 * 1000;
  const punching = {
    pass: Nct <= Nkt + 1e-3,
    message: Nct <= Nkt ? `Chọc thủng Nct=${Nct.toFixed(1)} ≤ Nkt=${Nkt.toFixed(1)} kN` : `Chọc thủng Nct=${Nct.toFixed(1)} > Nkt=${Nkt.toFixed(1)}`,
    Nct: safe(Nct),
    Nkt: safe(Nkt),
    um: safe(um),
  };

  const ox = Math.max(cx1, cx2, 0.01);
  const oy = Math.max(cy1, cy2, 0.01);
  const My_cant = (pUls * ox * ox) / 2;
  const Mx_cant = (pUls * oy * oy) / 2;
  const M_for_AsX = Math.max(My_cant, Math.abs(MyBase) / Lx);
  const M_for_AsY = Math.max(Mx_cant, Math.abs(MxBase) / Ly);

  const AsXReq = Math.max((M_for_AsX * 1e6) / (0.9 * s.Rs * h0 * 1000), 0);
  const AsYReq = Math.max((M_for_AsY * 1e6) / (0.9 * s.Rs * h0 * 1000), 0);
  const AsMin = 0.001 * 1000 * h0 * 1000;
  const AsXMin = AsMin;
  const AsYMin = AsMin;

  const px = parseFoundationBars(input.barsX ?? '', 1000);
  const py = parseFoundationBars(input.barsY ?? '', 1000);
  const AsXProv = px.ok ? px.As : 0;
  const AsYProv = py.ok ? py.As : 0;

  const needX = Math.max(AsXReq, AsXMin);
  const needY = Math.max(AsYReq, AsYMin);
  const flexureX = check(
    AsXProv + 1e-6 >= needX,
    AsXProv >= needX ? `Asx ${AsXProv.toFixed(0)} ≥ ${needX.toFixed(0)} mm²/m` : `Asx thiếu ${AsXProv.toFixed(0)} < ${needX.toFixed(0)}`
  );
  const flexureY = check(
    AsYProv + 1e-6 >= needY,
    AsYProv >= needY ? `Asy ${AsYProv.toFixed(0)} ≥ ${needY.toFixed(0)} mm²/m` : `Asy thiếu ${AsYProv.toFixed(0)} < ${needY.toFixed(0)}`
  );

  const warnings = [
    'Móng V1.0: theo MongDon.xlsm (ThuyetMinh) — p_avg/max/min, chọc thủng, uốn console đơn giản',
    'Chưa: hệ số A/B/D từ φ đất đầy đủ, lún chi tiết, trượt/lật — chưa khóa TCVN',
  ];
  if (eccX > Lx / 6 || eccY > Ly / 6) {
    warnings.push(`Lệch tâm lớn: ex=${eccX.toFixed(3)}m, ey=${eccY.toFixed(3)}m (so với L/6)`);
  }

  const pass =
    soilAvg.pass && soilMax.pass && soilMin.pass && punching.pass && flexureX.pass && flexureY.pass;

  return {
    Af: safe(Af),
    Wx: safe(Wx),
    Wy: safe(Wy),
    Nbase: safe(Nuls),
    MxBase: safe(MxBase),
    MyBase: safe(MyBase),
    pAvg: safe(pAvg),
    pMax: safe(pMax),
    pMin: safe(pMin),
    eccX: safe(eccX),
    eccY: safe(eccY),
    soilAvg,
    soilMax,
    soilMin,
    punching,
    AsXReq: safe(AsXReq),
    AsYReq: safe(AsYReq),
    AsXMin: safe(AsXMin),
    AsYMin: safe(AsYMin),
    AsXProv,
    AsYProv,
    flexureX,
    flexureY,
    pass,
    warnings,
  };
}

export const createDefaultFoundation = (id: string = crypto.randomUUID()): FoundationInput => ({
  id,
  name: 'Móng đơn M1',
  Lx: 2.0,
  Ly: 2.0,
  Hf: 0.5,
  Df: 1.5,
  colB: 0.4,
  colH: 0.4,
  ex: 0,
  ey: 0,
  N: 800,
  Mx: 80,
  My: 60,
  Qx: 0,
  Qy: 0,
  concrete: 'B25',
  steel: 'CB400-V',
  a: 50,
  Rtc: 200,
  gammaSoil: 18,
  htn: 0.3,
  pg: 0,
  barsX: 'd12a150',
  barsY: 'd12a150',
});
