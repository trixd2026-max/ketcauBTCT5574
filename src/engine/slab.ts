/**
 * Slab (Sàn) V1 — strip design aligned with Slab.xlsm / Slab_Design + KiemTraUonCat patterns.
 */
import { getConcrete, getSteel } from './materials';
import { calcCrack } from './crack';
import { calcDeflection } from './deflection';

export type SlabInput = {
  id: string; name: string; b: number; h: number; Lx: number; Ly: number;
  Mtop: number; Mbot: number; Q: number; concrete: string; steel: string;
  aTop: number; aBottom: number; barsTop?: string; barsBottom?: string;
  AsTop?: number; AsBottom?: number; L?: number; humidity?: 'high' | 'mid' | 'low';
};

export type Check = { pass: boolean; message: string };

export type SlabResult = {
  AsTopReq: number; AsBotReq: number; AsTopProv: number; AsBotProv: number;
  muTop: number; muBot: number;
  flexureTop: Check; flexureBot: Check; shear: Check; crack: Check; deflection: Check;
  pass: boolean; warnings: string[];
};

const safe = (v: number) => (Number.isFinite(v) ? v : 0);
const check = (pass: boolean, message: string): Check => ({ pass, message });

export function parseSlabBars(spec: string, b = 1000): { As: number; ok: boolean } {
  const s = (spec || '').trim().toLowerCase().replace(/ø|ф/g, 'd');
  if (!s) return { As: 0, ok: false };
  let m = s.match(/d\s*([0-9]+(?:\.[0-9]+)?)\s*[a@]\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (m) {
    const dia = Number(m[1]); const spacing = Number(m[2]);
    if (dia && spacing) return { As: Math.round(((Math.PI * dia * dia) / 4) * (b / spacing) * 10) / 10, ok: true };
  }
  m = s.match(/([0-9]+)\s*d\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (m) {
    const n = Number(m[1]); const dia = Number(m[2]);
    return { As: Math.round(n * (Math.PI * dia * dia) / 4 * 10) / 10, ok: true };
  }
  return { As: 0, ok: false };
}

function asRequired(M: number, b: number, h: number, a: number, Rb: number, Rs: number): number {
  const ho = h - a;
  if (ho <= 0 || b <= 0) return 0;
  const alphaM = (Math.abs(M) * 1e6) / (b * ho * ho * Rb);
  if (alphaM >= 0.5) return Infinity;
  const xi = 1 - Math.sqrt(Math.max(0, 1 - 2 * alphaM));
  return (Rb * b * xi * ho) / Rs;
}

export function calcSlab(input: SlabInput): SlabResult {
  const c = getConcrete(input.concrete);
  const s = getSteel(input.steel);
  const b = input.b || 1000;
  const topP = parseSlabBars(input.barsTop ?? '', b);
  const botP = parseSlabBars(input.barsBottom ?? '', b);
  const AsTopProv = topP.ok ? topP.As : (input.AsTop ?? 0);
  const AsBotProv = botP.ok ? botP.As : (input.AsBottom ?? 0);
  const AsTopReq = asRequired(input.Mtop, b, input.h, input.aTop, c.Rb, s.Rs);
  const AsBotReq = asRequired(input.Mbot, b, input.h, input.aBottom, c.Rb, s.Rs);
  const hoT = input.h - input.aTop;
  const hoB = input.h - input.aBottom;
  const muTop = hoT > 0 ? (AsTopProv * 100) / (b * hoT) : 0;
  const muBot = hoB > 0 ? (AsBotProv * 100) / (b * hoB) : 0;
  const muMin = 0.1;
  const flexureTop = check(AsTopProv >= AsTopReq && muTop >= muMin && Number.isFinite(AsTopReq),
    AsTopProv >= AsTopReq && muTop >= muMin ? `M−: As ${AsTopProv.toFixed(0)} ≥ ${AsTopReq.toFixed(0)} mm²/m` : `M−: thiếu thép hoặc μ < ${muMin}%`);
  const flexureBot = check(AsBotProv >= AsBotReq && muBot >= muMin && Number.isFinite(AsBotReq),
    AsBotProv >= AsBotReq && muBot >= muMin ? `M+: As ${AsBotProv.toFixed(0)} ≥ ${AsBotReq.toFixed(0)} mm²/m` : `M+: thiếu thép hoặc μ < ${muMin}%`);
  const ho = Math.max(hoT, hoB);
  const qDemand = Math.abs(input.Q);
  const qbt = (0.3 * c.Rb * b * ho) / 1000;
  const shear = check(qDemand <= qbt, qDemand <= qbt ? `Cắt Q=${qDemand.toFixed(1)} ≤ Qbt=${qbt.toFixed(1)}` : `Cắt không đạt`);
  const Mser = Math.max(Math.abs(input.Mtop), Math.abs(input.Mbot)) / 1.4;
  const useTop = Math.abs(input.Mtop) >= Math.abs(input.Mbot);
  const crackR = calcCrack({
    b, h: input.h, a: useTop ? input.aTop : input.aBottom, aPrime: useTop ? input.aBottom : input.aTop,
    As: useTop ? AsTopProv : AsBotProv, AsPrime: useTop ? AsBotProv : AsTopProv, ds: 10,
    concrete: input.concrete, steel: input.steel, Mshort: Mser, Mlong: Mser * 0.7, humidity: input.humidity ?? 'mid',
  });
  const defR = calcDeflection({
    b, h: input.h, a: useTop ? input.aTop : input.aBottom, aPrime: useTop ? input.aBottom : input.aTop,
    As: useTop ? AsTopProv : AsBotProv, AsPrime: useTop ? AsBotProv : AsTopProv, ds: 10,
    concrete: input.concrete, steel: input.steel, Mshort: Mser, Mlong: Mser * 0.7,
    L: input.L ?? Math.min(input.Lx, input.Ly), support: 'continuous', limitRatio: 250, humidity: input.humidity ?? 'mid',
  });
  const warnings = [...crackR.warnings, ...defR.warnings, 'Sàn V1: theo strip 1m, đối chiếu Slab.xlsm — chưa chọc thủng đầy đủ'];
  const pass = flexureTop.pass && flexureBot.pass && shear.pass && crackR.pass && ((input.L ?? 0) <= 0 || defR.pass);
  return {
    AsTopReq: safe(AsTopReq), AsBotReq: safe(AsBotReq), AsTopProv, AsBotProv, muTop, muBot,
    flexureTop, flexureBot, shear,
    crack: { pass: crackR.pass, message: crackR.pass ? 'Nứt đạt' : 'Nứt không đạt' },
    deflection: { pass: (input.L ?? 0) <= 0 || defR.pass, message: (input.L ?? 0) <= 0 ? 'Chưa nhập L võng' : defR.pass ? 'Võng đạt (ước lượng)' : 'Võng không đạt' },
    pass, warnings,
  };
}

export const createDefaultSlab = (id: string = crypto.randomUUID()): SlabInput => ({
  id, name: 'Sàn mới', b: 1000, h: 150, Lx: 4, Ly: 5, Mtop: 12, Mbot: 18, Q: 25,
  concrete: 'B25', steel: 'CB400-V', aTop: 25, aBottom: 25,
  barsTop: 'd10a200', barsBottom: 'd12a150', L: 4, humidity: 'mid',
});
