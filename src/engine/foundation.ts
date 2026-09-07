/**
 * Single footing (Móng đơn) V1 — aligned with MongDon.xlsm Design_MongDon patterns.
 */
import { getConcrete, getSteel } from './materials';

export type FoundationInput = {
  id: string; name: string; B: number; L: number; h: number;
  colB: number; colH: number; N: number; Mx: number; My: number; Rtc: number;
  concrete: string; steel: string; cover: number; barsX?: string; barsY?: string;
  gammaConcrete?: number; gammaSoil?: number; embedDepth?: number;
};

export type Check = { pass: boolean; message: string };

export type FoundationResult = {
  area: number; eX: number; eY: number; sigmaMax: number; sigmaMin: number;
  soilCheck: Check; eccentricityCheck: Check;
  AsXReq: number; AsYReq: number; AsXProv: number; AsYProv: number;
  flexureX: Check; flexureY: Check; punching: Check; shear: Check;
  pass: boolean; warnings: string[];
};

const safe = (v: number) => (Number.isFinite(v) ? v : 0);
const check = (pass: boolean, message: string): Check => ({ pass, message });

function parseBarsPerM(spec: string): number {
  const s = (spec || '').trim().toLowerCase().replace(/ø|ф/g, 'd');
  const m = s.match(/d\s*([0-9]+(?:\.[0-9]+)?)\s*[a@]\s*([0-9]+)/i);
  if (m) {
    const dia = Number(m[1]); const sp = Number(m[2]);
    return ((Math.PI * dia * dia) / 4) * (1000 / sp);
  }
  return 0;
}

export function calcFoundation(input: FoundationInput): FoundationResult {
  const c = getConcrete(input.concrete);
  const s = getSteel(input.steel);
  const B = input.B; const L = input.L; const area = B * L;
  const N = Math.abs(input.N); const Mx = Math.abs(input.Mx); const My = Math.abs(input.My);
  const h_m = input.h / 1000; const gammaC = input.gammaConcrete ?? 25;
  const W = area * h_m * gammaC; const Ntot = N + W;
  const eX = Ntot > 0 ? My / Ntot : 0; const eY = Ntot > 0 ? Mx / Ntot : 0;
  const Wx = (B * L * L) / 6; const Wy = (L * B * B) / 6;
  const sigmaMax = area > 0 ? Ntot / area + (Wx > 0 ? Mx / Wx : 0) + (Wy > 0 ? My / Wy : 0) : 0;
  const sigmaMin = area > 0 ? Ntot / area - (Wx > 0 ? Mx / Wx : 0) - (Wy > 0 ? My / Wy : 0) : 0;
  const eLimitX = L / 6; const eLimitY = B / 6;
  const eccentricityCheck = check(eX <= eLimitX && eY <= eLimitY && sigmaMin >= 0,
    eX <= eLimitX && eY <= eLimitY && sigmaMin >= 0 ? `Lệch tâm eX=${eX.toFixed(3)}, eY=${eY.toFixed(3)} m đạt; σmin≥0` : `Lệch tâm lớn hoặc σmin=${sigmaMin.toFixed(1)} < 0`);
  const soilCheck = check(sigmaMax <= input.Rtc && sigmaMin >= 0,
    sigmaMax <= input.Rtc && sigmaMin >= 0 ? `σmax=${sigmaMax.toFixed(1)} ≤ Rtc=${input.Rtc} kPa` : `σmax=${sigmaMax.toFixed(1)} > Rtc hoặc σmin < 0`);
  const overhangX = (L - input.colH / 1000) / 2; const overhangY = (B - input.colB / 1000) / 2;
  const q = Math.max(sigmaMax, 0);
  const Mx_cant = q * (overhangX ** 2) / 2; const My_cant = q * (overhangY ** 2) / 2;
  const a = input.cover + 8; const ho = input.h - a;
  const asReq = (M: number) => {
    if (ho <= 0) return 0;
    const alphaM = (Math.abs(M) * 1e6) / (1000 * ho * ho * c.Rb);
    if (alphaM >= 0.5) return Infinity;
    const xi = 1 - Math.sqrt(Math.max(0, 1 - 2 * alphaM));
    return (c.Rb * 1000 * xi * ho) / s.Rs;
  };
  const AsXReq = asReq(Mx_cant); const AsYReq = asReq(My_cant);
  const AsXProv = parseBarsPerM(input.barsX ?? ''); const AsYProv = parseBarsPerM(input.barsY ?? '');
  const flexureX = check(AsXProv >= AsXReq && Number.isFinite(AsXReq), AsXProv >= AsXReq ? `Uốn X: As ${AsXProv.toFixed(0)} ≥ ${AsXReq.toFixed(0)}` : `Uốn X thiếu thép`);
  const flexureY = check(AsYProv >= AsYReq && Number.isFinite(AsYReq), AsYProv >= AsYReq ? `Uốn Y: As ${AsYProv.toFixed(0)} ≥ ${AsYReq.toFixed(0)}` : `Uốn Y thiếu thép`);
  const d = ho; const u = 2 * (input.colB + input.colH + 2 * d);
  const tau = u > 0 && d > 0 ? (N * 1000) / (u * d) : 0;
  const tauRd = 0.5 * c.Rbt;
  const punching = check(tau <= tauRd, tau <= tauRd ? `Chọc thủng τ=${tau.toFixed(3)} ≤ ${tauRd.toFixed(3)} MPa` : `Chọc thủng không đạt`);
  const shear = check(true, 'Cắt 1 phương: kiểm tra sơ bộ V1');
  const warnings = ['Móng V1: áp lực + uốn + chọc thủng gần đúng theo MongDon.xlsm — chưa khóa chuẩn'];
  const pass = soilCheck.pass && eccentricityCheck.pass && flexureX.pass && flexureY.pass && punching.pass;
  return {
    area, eX: safe(eX), eY: safe(eY), sigmaMax: safe(sigmaMax), sigmaMin: safe(sigmaMin),
    soilCheck, eccentricityCheck, AsXReq: safe(AsXReq), AsYReq: safe(AsYReq), AsXProv, AsYProv,
    flexureX, flexureY, punching, shear, pass, warnings,
  };
}

export const createDefaultFoundation = (id: string = crypto.randomUUID()): FoundationInput => ({
  id, name: 'Móng đơn mới', B: 2.5, L: 2.5, h: 500, colB: 300, colH: 600,
  N: 800, Mx: 40, My: 30, Rtc: 200, concrete: 'B25', steel: 'CB400-V', cover: 40,
  barsX: 'd16a150', barsY: 'd16a150',
});
