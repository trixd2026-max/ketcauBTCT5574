/**
 * Slab (Sàn) V1.1 — strip 1 m design aligned with Slab.xlsm
 * (Slab_Design, KiemTraUonCat, KiemTraNut).
 * Units: mm, MPa, kNm/m, kN/m
 * Not full two-way punching / TCVN-locked until golden cases verified.
 */
import { getConcrete, getSteel, type Humidity } from './materials';
import { calcCrack } from './crack';
import { calcDeflection } from './deflection';

export type SlabInput = {
  id: string;
  name: string;
  b: number;
  h: number;
  Lx: number;
  Ly: number;
  Mtop: number;
  Mbot: number;
  Q: number;
  concrete: string;
  steel: string;
  aTop: number;
  aBottom: number;
  barsTop?: string;
  barsBottom?: string;
  AsTop?: number;
  AsBottom?: number;
  L?: number;
  humidity?: Humidity;
  support?: 'simple' | 'continuous' | 'cantilever';
  gammaBt?: number;
};

export type Check = { pass: boolean; message: string };

export type SlabResult = {
  AsTopReq: number;
  AsBotReq: number;
  AsTopProv: number;
  AsBotProv: number;
  muTop: number;
  muBot: number;
  muMin: number;
  xiTop: number;
  xiBot: number;
  xiR: number;
  MuTop: number;
  MuBot: number;
  flexureTop: Check;
  flexureBot: Check;
  shear: Check;
  crack: Check & { Mcrc?: number; acrcShort?: number | null; acrcLong?: number | null };
  deflection: Check & { deltaShort?: number; deltaLong?: number; limit?: number };
  pass: boolean;
  warnings: string[];
};

const safe = (v: number) => (Number.isFinite(v) ? v : 0);
const check = (pass: boolean, message: string): Check => ({ pass, message });

export function parseSlabBars(spec: string, b = 1000): { As: number; dia: number; ok: boolean } {
  const s = (spec || '').trim().toLowerCase().replace(/ø|ф/g, 'd');
  if (!s) return { As: 0, dia: 0, ok: false };
  let m = s.match(/d\s*([0-9]+(?:\.[0-9]+)?)\s*[a@]\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (m) {
    const dia = Number(m[1]);
    const spacing = Number(m[2]);
    if (dia && spacing) {
      const As = ((Math.PI * dia * dia) / 4) * (b / spacing);
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

function flexureSection(
  M: number,
  b: number,
  h: number,
  a: number,
  Rb: number,
  Rs: number,
  gammaBt: number
) {
  const ho = h - a;
  if (ho <= 0 || b <= 0) {
    return { AsReq: 0, xi: 0, alphaM: 0, Mu: 0, ho, xiR: 0.53 };
  }
  const RbEff = Rb * gammaBt;
  const alphaM = (Math.abs(M) * 1e6) / (b * ho * ho * RbEff);
  const xiR = 0.8 / (1 + Rs / 200000 / 0.0035);
  if (alphaM >= 0.5) {
    return { AsReq: Infinity, xi: 1, alphaM, Mu: 0, ho, xiR };
  }
  const xi = 1 - Math.sqrt(Math.max(0, 1 - 2 * alphaM));
  const AsReq = (RbEff * b * xi * ho) / Rs;
  const Mu = (RbEff * b * xi * ho * (ho - 0.5 * xi * ho)) / 1e6;
  return { AsReq, xi, alphaM, Mu, ho, xiR };
}

function muCapacity(As: number, b: number, ho: number, RbEff: number, Rs: number): number {
  if (ho <= 0 || b <= 0 || As <= 0) return 0;
  const xi = Math.min((As * Rs) / (RbEff * b * ho), 0.8);
  return (RbEff * b * xi * ho * (ho - 0.5 * xi * ho)) / 1e6;
}

export function calcSlab(input: SlabInput): SlabResult {
  const c = getConcrete(input.concrete);
  const s = getSteel(input.steel);
  const b = input.b || 1000;
  const gammaBt = input.gammaBt ?? 0.9;
  const muMin = 0.1;

  const topP = parseSlabBars(input.barsTop ?? '', b);
  const botP = parseSlabBars(input.barsBottom ?? '', b);
  const AsTopProv = topP.ok ? topP.As : (input.AsTop ?? 0);
  const AsBotProv = botP.ok ? botP.As : (input.AsBottom ?? 0);
  const dsTop = topP.ok ? topP.dia : 10;
  const dsBot = botP.ok ? botP.dia : 10;

  const top = flexureSection(input.Mtop, b, input.h, input.aTop, c.Rb, s.Rs, gammaBt);
  const bot = flexureSection(input.Mbot, b, input.h, input.aBottom, c.Rb, s.Rs, gammaBt);
  const xiR = top.xiR ?? bot.xiR ?? 0.53;

  const AsTopReq = top.AsReq;
  const AsBotReq = bot.AsReq;
  const MuTop = muCapacity(AsTopProv, b, top.ho, c.Rb * gammaBt, s.Rs);
  const MuBot = muCapacity(AsBotProv, b, bot.ho, c.Rb * gammaBt, s.Rs);

  const muTop = top.ho > 0 ? (AsTopProv * 100) / (b * top.ho) : 0;
  const muBot = bot.ho > 0 ? (AsBotProv * 100) / (b * bot.ho) : 0;

  const flexureTop = check(
    AsTopProv + 1e-6 >= AsTopReq &&
      muTop + 1e-9 >= muMin &&
      Number.isFinite(AsTopReq) &&
      Math.abs(input.Mtop) <= MuTop + 1e-6,
    Number.isFinite(AsTopReq) && AsTopProv >= AsTopReq && muTop >= muMin
      ? `M−: As ${AsTopProv.toFixed(0)} ≥ ${AsTopReq.toFixed(0)} mm²/m; |M|≤Mu=${MuTop.toFixed(1)}`
      : `M−: thiếu thép hoặc μ < ${muMin}%`
  );
  const flexureBot = check(
    AsBotProv + 1e-6 >= AsBotReq &&
      muBot + 1e-9 >= muMin &&
      Number.isFinite(AsBotReq) &&
      Math.abs(input.Mbot) <= MuBot + 1e-6,
    Number.isFinite(AsBotReq) && AsBotProv >= AsBotReq && muBot >= muMin
      ? `M+: As ${AsBotProv.toFixed(0)} ≥ ${AsBotReq.toFixed(0)} mm²/m; |M|≤Mu=${MuBot.toFixed(1)}`
      : `M+: thiếu thép hoặc μ < ${muMin}%`
  );

  const ho = Math.max(top.ho, bot.ho);
  const qDemand = Math.abs(input.Q);
  const qbt = (0.3 * gammaBt * c.Rb * b * ho) / 1000;
  const shear = check(
    qDemand <= qbt + 1e-6,
    qDemand <= qbt
      ? `Cắt Q=${qDemand.toFixed(1)} ≤ Qbt=${qbt.toFixed(1)} kN/m`
      : `Cắt không đạt Q=${qDemand.toFixed(1)} > Qbt=${qbt.toFixed(1)}`
  );

  const Mser = Math.max(Math.abs(input.Mtop), Math.abs(input.Mbot)) / 1.4;
  const useTop = Math.abs(input.Mtop) >= Math.abs(input.Mbot);
  const crackR = calcCrack({
    b,
    h: input.h,
    a: useTop ? input.aTop : input.aBottom,
    aPrime: useTop ? input.aBottom : input.aTop,
    As: useTop ? AsTopProv : AsBotProv,
    AsPrime: useTop ? AsBotProv : AsTopProv,
    ds: useTop ? dsTop : dsBot,
    concrete: input.concrete,
    steel: input.steel,
    Mshort: Mser,
    Mlong: Mser * 0.7,
    humidity: input.humidity ?? 'mid',
  });
  const Ldef = input.L ?? Math.min(input.Lx || 0, input.Ly || 0) || 0;
  const defR = calcDeflection({
    b,
    h: input.h,
    a: useTop ? input.aTop : input.aBottom,
    aPrime: useTop ? input.aBottom : input.aTop,
    As: useTop ? AsTopProv : AsBotProv,
    AsPrime: useTop ? AsBotProv : AsTopProv,
    ds: useTop ? dsTop : dsBot,
    concrete: input.concrete,
    steel: input.steel,
    Mshort: Mser,
    Mlong: Mser * 0.7,
    L: Ldef > 0 ? Ldef : 1,
    support: input.support ?? 'continuous',
    limitRatio: 250,
    humidity: input.humidity ?? 'mid',
  });

  const warnings = [
    ...crackR.warnings.slice(0, 3),
    ...defR.warnings.slice(0, 2),
    'Sàn V1.1: strip 1m theo Slab.xlsm — chưa chọc thủng / 2 phương đầy đủ; chưa khóa TCVN',
  ];

  const crackCheck = {
    pass: crackR.pass,
    message: crackR.pass ? 'Nứt đạt' : 'Nứt không đạt',
    Mcrc: crackR.Mcrc,
    acrcShort: crackR.acrcShort,
    acrcLong: crackR.acrcLong,
  };
  const defCheck = {
    pass: Ldef <= 0 || defR.pass,
    message: Ldef <= 0 ? 'Chưa nhập L võng' : defR.pass ? 'Võng đạt (ước lượng)' : 'Võng không đạt',
    deltaShort: defR.deltaShort,
    deltaLong: defR.deltaLong,
    limit: defR.limit,
  };

  const pass = flexureTop.pass && flexureBot.pass && shear.pass && crackCheck.pass && defCheck.pass;

  return {
    AsTopReq: safe(AsTopReq),
    AsBotReq: safe(AsBotReq),
    AsTopProv,
    AsBotProv,
    muTop: safe(muTop),
    muBot: safe(muBot),
    muMin,
    xiTop: safe(top.xi),
    xiBot: safe(bot.xi),
    xiR: safe(xiR),
    MuTop: safe(MuTop),
    MuBot: safe(MuBot),
    flexureTop,
    flexureBot,
    shear,
    crack: crackCheck,
    deflection: defCheck,
    pass,
    warnings,
  };
}

export const createDefaultSlab = (id: string = crypto.randomUUID()): SlabInput => ({
  id,
  name: 'Sàn mới',
  b: 1000,
  h: 150,
  Lx: 4,
  Ly: 5,
  Mtop: 12,
  Mbot: 18,
  Q: 25,
  concrete: 'B25',
  steel: 'CB400-V',
  aTop: 25,
  aBottom: 25,
  barsTop: 'd10a200',
  barsBottom: 'd12a150',
  L: 4,
  humidity: 'mid',
  support: 'continuous',
  gammaBt: 0.9,
});
