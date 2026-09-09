/**
 * Sàn BTCT — strip 1m + bố trí 2 phương + chọc thủng quanh cột (theo hướng Slab.xlsm).
 * Uốn 1m dải; chọc thủng khi có N + colB×colH.
 */
import { getConcrete, getSteel, type Humidity } from './materials';
import { calcCrack } from './crack';
import { calcDeflection } from './deflection';

export type SlabInput = {
  id: string;
  name: string;
  /** Bề rộng dải tính (mm) — mặc định 1000 */
  b: number;
  h: number;
  Lx: number;
  Ly: number;
  /** Moment dải chính (tương thích cũ) */
  Mtop: number;
  Mbot: number;
  /** Moment 2 phương (kNm/m) — nếu bỏ trống dùng Mtop/Mbot */
  MxTop?: number;
  MxBot?: number;
  MyTop?: number;
  MyBot?: number;
  Q: number;
  concrete: string;
  steel: string;
  aTop: number;
  aBottom: number;
  barsTop?: string;
  barsBottom?: string;
  /** Bố trí 2 phương */
  barsTopX?: string;
  barsTopY?: string;
  barsBotX?: string;
  barsBotY?: string;
  AsTop?: number;
  AsBottom?: number;
  L?: number;
  humidity?: Humidity;
  support?: 'simple' | 'continuous' | 'cantilever';
  gammaBt?: number;
  /** Chọc thủng — phản lực cột (kN) + tiết diện cột (mm) */
  N?: number;
  colB?: number;
  colH?: number;
};

export type Check = { pass: boolean; message: string };

export type SlabResult = {
  /** Chiều cao làm việc trên/dưới: ho = h − a bảo vệ */
  hoTop: number;
  hoBot: number;
  aTop: number;
  aBottom: number;
  AsTopReq: number;
  AsBotReq: number;
  AsTopProv: number;
  AsBotProv: number;
  AsTopXReq: number;
  AsTopYReq: number;
  AsBotXReq: number;
  AsBotYReq: number;
  AsTopXProv: number;
  AsTopYProv: number;
  AsBotXProv: number;
  AsBotYProv: number;
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
  flexureX: Check;
  flexureY: Check;
  shear: Check;
  punching: Check & { Nct: number; Nkt: number; um: number; ho: number };
  crack: Check & { Mcrc?: number; acrcShort?: number | null; acrcLong?: number | null };
  deflection: Check & { deltaShort?: number; deltaLong?: number; limit?: number; EIshort?: number; EIlong?: number };
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

function flexureAs(M: number, b: number, ho: number, Rb: number, Rs: number, xiR: number) {
  const M_Nmm = Math.abs(M) * 1e6;
  if (ho <= 0 || b <= 0 || Rb <= 0) return { As: 0, alphaM: 0, xi: 0, Mu: 0 };
  const alphaM = M_Nmm / (Rb * b * ho * ho);
  const disc = 1 - 2 * alphaM;
  let xi = disc > 0 ? 1 - Math.sqrt(disc) : xiR;
  if (xi > xiR) xi = xiR;
  if (xi < 0) xi = 0;
  const As = (xi * Rb * b * ho) / Rs;
  const Mu = (xi * (1 - 0.5 * xi) * Rb * b * ho * ho) / 1e6;
  return { As: safe(As), alphaM: safe(alphaM), xi: safe(xi), Mu: safe(Mu) };
}

export function calcSlab(input: SlabInput): SlabResult {
  const c = getConcrete(input.concrete);
  const s = getSteel(input.steel);
  const b = input.b || 1000;
  const Rs = s.Rs;
  const Rb = c.Rb;
  const Rbt = c.Rbt * (input.gammaBt ?? 0.9);
  const xiR = 0.8 / (1 + Rs / 700);

  const MxTop = input.MxTop ?? input.Mtop;
  const MxBot = input.MxBot ?? input.Mbot;
  const MyTop = input.MyTop ?? input.Mtop;
  const MyBot = input.MyBot ?? input.Mbot;

  // a bảo vệ → chiều cao làm việc (TCVN 5574)
  const aTop = Math.max(input.aTop || 0, 0);
  const aBottom = Math.max(input.aBottom || 0, 0);
  const hoTop = Math.max(input.h - aTop, 1);
  const hoBot = Math.max(input.h - aBottom, 1);

  const topX = flexureAs(MxTop, b, hoTop, Rb, Rs, xiR);
  const botX = flexureAs(MxBot, b, hoBot, Rb, Rs, xiR);
  const topY = flexureAs(MyTop, b, hoTop, Rb, Rs, xiR);
  const botY = flexureAs(MyBot, b, hoBot, Rb, Rs, xiR);

  // legacy single-direction max for report compatibility
  const AsTopReq = Math.max(topX.As, topY.As);
  const AsBotReq = Math.max(botX.As, botY.As);

  const parse = (spec: string | undefined, fallbackAs?: number) => {
    const p = parseSlabBars(spec || '', b);
    if (p.ok) return p.As;
    return fallbackAs ?? 0;
  };

  const AsTopXProv = parse(input.barsTopX, parse(input.barsTop, input.AsTop));
  const AsTopYProv = parse(input.barsTopY, parse(input.barsTop, input.AsTop));
  const AsBotXProv = parse(input.barsBotX, parse(input.barsBottom, input.AsBottom));
  const AsBotYProv = parse(input.barsBotY, parse(input.barsBottom, input.AsBottom));

  const AsTopProv = Math.min(AsTopXProv || AsTopReq, AsTopYProv || AsTopReq) || Math.max(AsTopXProv, AsTopYProv);
  const AsBotProv = Math.min(AsBotXProv || AsBotReq, AsBotYProv || AsBotReq) || Math.max(AsBotXProv, AsBotYProv);
  // Prefer max provided for safety check display
  const AsTopProvMax = Math.max(AsTopXProv, AsTopYProv, parse(input.barsTop, input.AsTop));
  const AsBotProvMax = Math.max(AsBotXProv, AsBotYProv, parse(input.barsBottom, input.AsBottom));

  const muMin = 0.1;
  const muTop = (AsTopProvMax / (b * hoTop)) * 100;
  const muBot = (AsBotProvMax / (b * hoBot)) * 100;

  const flexureX = check(
    AsTopXProv + 1e-6 >= topX.As && AsBotXProv + 1e-6 >= botX.As,
    `Phương X: As trên ${AsTopXProv.toFixed(0)}/${topX.As.toFixed(0)} · dưới ${AsBotXProv.toFixed(0)}/${botX.As.toFixed(0)} mm²/m`
  );
  const flexureY = check(
    AsTopYProv + 1e-6 >= topY.As && AsBotYProv + 1e-6 >= botY.As,
    `Phương Y: As trên ${AsTopYProv.toFixed(0)}/${topY.As.toFixed(0)} · dưới ${AsBotYProv.toFixed(0)}/${botY.As.toFixed(0)} mm²/m`
  );
  const flexureTop = check(
    AsTopProvMax + 1e-6 >= AsTopReq && muTop >= muMin,
    AsTopProvMax >= AsTopReq
      ? `Uốn trên: As ${AsTopProvMax.toFixed(0)} ≥ ${AsTopReq.toFixed(0)} mm²/m`
      : `Uốn trên: As ${AsTopProvMax.toFixed(0)} < ${AsTopReq.toFixed(0)} mm²/m`
  );
  const flexureBot = check(
    AsBotProvMax + 1e-6 >= AsBotReq && muBot >= muMin,
    AsBotProvMax >= AsBotReq
      ? `Uốn dưới: As ${AsBotProvMax.toFixed(0)} ≥ ${AsBotReq.toFixed(0)} mm²/m`
      : `Uốn dưới: As ${AsBotProvMax.toFixed(0)} < ${AsBotReq.toFixed(0)} mm²/m`
  );

  const Q = Math.abs(input.Q);
  const qbt = (Rbt * b * Math.min(hoTop, hoBot)) / 1000; // kN
  const shear = check(Q <= qbt + 1e-6, `Cắt dải: Q=${Q.toFixed(1)} ${Q <= qbt ? '≤' : '>'} Qbt=${qbt.toFixed(1)} kN/m`);

  // Punching around column
  const N = Math.abs(input.N ?? 0);
  const colB = input.colB ?? 0;
  const colH = input.colH ?? 0;
  const hoP = Math.min(hoTop, hoBot);
  let punching: SlabResult['punching'] = {
    pass: true,
    message: 'Không kiểm chọc thủng (chưa nhập N / cột)',
    Nct: 0,
    Nkt: 0,
    um: 0,
    ho: hoP,
  };
  if (N > 0 && colB > 0 && colH > 0 && hoP > 0) {
    const um_mm = 2 * (colB + hoP + colH + hoP);
    const Nkt2 = (Rbt * um_mm * hoP) / 1000;
    const passP = N <= Nkt2 + 1e-3;
    punching = {
      pass: passP,
      message: `Chọc thủng: Nct=${N.toFixed(1)} ${passP ? '≤' : '>'} Nkt=${Nkt2.toFixed(1)} kN (u=${um_mm.toFixed(0)} mm)`,
      Nct: N,
      Nkt: Nkt2,
      um: um_mm,
      ho: hoP,
    };
  }

  const useTop = Math.abs(MxTop) >= Math.abs(MxBot);
  const Mser = Math.abs(useTop ? MxTop : MxBot) / 1.4;
  const AsCr = useTop ? AsTopProvMax : AsBotProvMax;
  const AsCrP = useTop ? AsBotProvMax : AsTopProvMax;
  const a = useTop ? aTop : aBottom;
  const aP = useTop ? aBottom : aTop;
  const ds = 12;
  const crackR = calcCrack({
    b,
    h: input.h,
    a,
    aPrime: aP,
    As: AsCr,
    AsPrime: AsCrP,
    ds,
    concrete: input.concrete,
    steel: input.steel,
    Mshort: Mser,
    Mlong: Mser * 0.7,
    humidity: input.humidity ?? 'mid',
  });
  const Ldef = input.L ?? (Math.min(input.Lx || 0, input.Ly || 0) || 0);
  const defR = calcDeflection({
    b,
    h: input.h,
    a,
    aPrime: aP,
    As: AsCr,
    AsPrime: AsCrP,
    ds,
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
    ...crackR.warnings.slice(0, 2),
    ...defR.warnings.slice(0, 2),
  ];
  if ((input.barsTopX || input.barsTopY) && flexureX.pass && flexureY.pass) {
    /* ok */
  } else if (!input.barsTopX && !input.barsTopY) {
    warnings.push('Sàn: dùng 1 lớp thép chung 2 phương — nên nhập barsTopX/Y, barsBotX/Y');
  }

  const crackCheck = {
    pass: crackR.pass,
    message: crackR.pass ? 'Nứt đạt' : 'Nứt không đạt',
    Mcrc: crackR.Mcrc,
    acrcShort: crackR.acrcShort,
    acrcLong: crackR.acrcLong,
  };
  const defCheck = {
    pass: Ldef <= 0 || defR.pass,
    message:
      Ldef <= 0
        ? 'Chưa nhập L võng'
        : defR.pass
          ? `Võng đạt (EI ${defR.cracked ? 'có nứt' : 'chưa nứt'})`
          : 'Võng không đạt',
    deltaShort: defR.deltaShort,
    deltaLong: defR.deltaLong,
    limit: defR.limit,
    EIshort: defR.EIshort,
    EIlong: defR.EIlong,
  };

  const twoWayOk = flexureX.pass && flexureY.pass;
  const pass =
    flexureTop.pass &&
    flexureBot.pass &&
    twoWayOk &&
    shear.pass &&
    punching.pass &&
    crackCheck.pass &&
    defCheck.pass;

  return {
    hoTop: safe(hoTop),
    hoBot: safe(hoBot),
    aTop: safe(aTop),
    aBottom: safe(aBottom),
    AsTopReq: safe(AsTopReq),
    AsBotReq: safe(AsBotReq),
    AsTopProv: safe(AsTopProvMax),
    AsBotProv: safe(AsBotProvMax),
    AsTopXReq: safe(topX.As),
    AsTopYReq: safe(topY.As),
    AsBotXReq: safe(botX.As),
    AsBotYReq: safe(botY.As),
    AsTopXProv: safe(AsTopXProv),
    AsTopYProv: safe(AsTopYProv),
    AsBotXProv: safe(AsBotXProv),
    AsBotYProv: safe(AsBotYProv),
    muTop: safe(muTop),
    muBot: safe(muBot),
    muMin,
    xiTop: safe(topX.xi),
    xiBot: safe(botX.xi),
    xiR: safe(xiR),
    MuTop: safe(Math.max(topX.Mu, topY.Mu)),
    MuBot: safe(Math.max(botX.Mu, botY.Mu)),
    flexureTop,
    flexureBot,
    flexureX,
    flexureY,
    shear,
    punching,
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
  MxTop: 12,
  MxBot: 18,
  MyTop: 10,
  MyBot: 15,
  Q: 25,
  concrete: 'B25',
  steel: 'CB400-V',
  aTop: 25,
  aBottom: 25,
  barsTop: 'd10a200',
  barsBottom: 'd12a150',
  barsTopX: 'd10a200',
  barsTopY: 'd10a200',
  barsBotX: 'd12a150',
  barsBotY: 'd12a150',
  L: 4,
  humidity: 'mid',
  support: 'continuous',
  gammaBt: 0.9,
  N: 0,
  colB: 300,
  colH: 300,
});
