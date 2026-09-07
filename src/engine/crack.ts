/**
 * Crack width check (TCVN 5574:2018) — single critical section.
 * Formulas transcribed / adapted from Beam.xlsm / KiemTraNut.
 * Units: mm, MPa, kN.m
 */
import {
  getConcrete,
  getSteel,
  EB1_RED_SHORT,
  EB1_RED_LONG,
  ACRC_LIMIT_SHORT,
  ACRC_LIMIT_LONG,
  type Humidity,
} from './materials';

export type CrackInput = {
  b: number;
  h: number;
  /** Cover to centroid of tension steel (mm) */
  a: number;
  /** Cover to centroid of compression steel (mm) */
  aPrime: number;
  /** Tension steel area (mm²) */
  As: number;
  /** Compression steel area (mm²) — 0 if singly reinforced */
  AsPrime: number;
  /** Nominal diameter of tension bars (mm) — for Ls */
  ds: number;
  concrete: string;
  steel: string;
  /** Service moment short-term |M| (kNm) — TT+HT */
  Mshort: number;
  /** Service moment long-term |M| (kNm) — TT+HTDH */
  Mlong: number;
  humidity?: Humidity;
};

export type Check = { pass: boolean; message: string };

export type CrackResult = {
  /** Uncracked transformed section */
  Ared: number;
  yt: number;
  Ired1: number;
  Wred: number;
  Wpl: number;
  Mcrc: number;
  cracked: boolean;
  /** Cracked section (only meaningful if cracked) */
  yc: number;
  Ired2: number;
  Ls: number;
  /** Short-term crack width (mm); null if no crack */
  acrcShort: number | null;
  /** Long-term crack width (mm); null if no crack */
  acrcLong: number | null;
  limitShort: number;
  limitLong: number;
  checkShort: Check;
  checkLong: Check;
  pass: boolean;
  warnings: string[];
};

const safe = (v: number) => (Number.isFinite(v) ? v : 0);
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

export function calcCrack(input: CrackInput): CrackResult {
  const c = getConcrete(input.concrete);
  const s = getSteel(input.steel);
  const humidity: Humidity = input.humidity ?? 'mid';
  const phiB = c.phiB[humidity];

  const b = input.b;
  const h = input.h;
  const a = input.a;
  const aP = input.aPrime;
  const As = Math.max(input.As, 0);
  const AsP = Math.max(input.AsPrime, 0);
  const ds = Math.max(input.ds, 6);
  const ho = h - a;
  const Ab = b * h;

  // α = Es / Eb (elastic)
  const alpha = s.Es / c.Eb;

  // --- Uncracked transformed section ---
  const Ared = Ab + alpha * As + alpha * AsP;
  const StRed = (Ab * h) / 2 + alpha * As * a + alpha * AsP * (h - aP);
  const yt = Ared > 0 ? StRed / Ared : h / 2;
  const I = (b * h ** 3) / 12 + Ab * (0.5 * h - yt) ** 2;
  const Is = As * (yt - a) ** 2;
  const IsP = AsP * (h - aP - yt) ** 2;
  const Ired1 = I + alpha * (Is + IsP);
  const Wred = yt > 0 ? Ired1 / yt : 0;
  const Wpl = 1.3 * Wred;
  // Mcrc (kNm)
  const Mcrc = (Wpl * c.RbtSer) / 1e6;

  const Mshort = Math.abs(input.Mshort);
  const Mlong = Math.abs(input.Mlong);
  // Crack if either service moment exceeds Mcrc
  const cracked = Mshort > Mcrc || Mlong > Mcrc;

  // --- Cracked section properties (for σs) ---
  // Eb,red short ≈ Rb,ser / εb1,red
  const alphaS1 = (EB1_RED_SHORT * s.Es) / c.RbSer; // ≈ Es / Eb,red
  // μs, μ's in absolute (not %)
  const muS = ho > 0 && b > 0 ? As / (b * ho) : 0;
  const muSp = ho > 0 && b > 0 ? AsP / (b * ho) : 0;

  // Neutral axis yc from quadratic (simplified double-reinforced cracked)
  let yc = ho * 0.4;
  if (ho > 0) {
    const t = muS * alphaS1 + muSp * alphaS1;
    const disc = t * t + 2 * (muS * alphaS1 + muSp * alphaS1 * (aP / ho));
    const root = Math.sqrt(Math.max(0, disc));
    yc = ho * (root - t);
    yc = clamp(yc, 0.05 * ho, 0.6 * ho);
  }

  const Ib = (b * yc ** 3) / 12 + b * yc * (yc / 2) ** 2;
  const IsCr = As * (ho - yc) ** 2;
  const IsPCr = AsP * (yc - aP) ** 2;
  const Ired2 = Ib + alphaS1 * (IsCr + IsPCr);

  // Abt for Ls
  const Abt = b * Math.min(Math.max(2 * a, h - yc), 0.5 * h);
  let Ls = 400;
  if (As > 0) {
    const raw = (0.5 * Abt * ds) / As;
    Ls = clamp(raw, Math.max(10 * ds, 100), Math.min(40 * ds, 400));
  }

  const limitShort = ACRC_LIMIT_SHORT;
  const limitLong = ACRC_LIMIT_LONG;
  const warnings: string[] = [];

  const computeAcrc = (M: number, phi1: number): number | null => {
    if (!cracked || M <= 0 || Ired2 <= 0) return null;
    const sigmaS = (M * 1e6 * (ho - yc) * alphaS1) / Ired2;
    let psiS = 1 - (0.8 * Mcrc) / M;
    if (psiS < 0.2) psiS = 0.2;
    const acrc = (phi1 * 0.5 * 1 * psiS * sigmaS * Ls) / s.Es;
    return safe(acrc);
  };

  const acrcShort = computeAcrc(Mshort, 1.0);
  const acrcLong = computeAcrc(Mlong, 1.4);

  const checkShort: Check =
    acrcShort === null
      ? { pass: true, message: cracked ? 'Không tính được acrc ngắn hạn' : 'Không nứt (M ≤ Mcrc)' }
      : acrcShort <= limitShort
        ? { pass: true, message: `acrc ngắn hạn = ${acrcShort.toFixed(3)} ≤ ${limitShort} mm` }
        : { pass: false, message: `acrc ngắn hạn = ${acrcShort.toFixed(3)} > ${limitShort} mm` };

  const checkLong: Check =
    acrcLong === null
      ? { pass: true, message: cracked ? 'Không tính được acrc dài hạn' : 'Không nứt (M ≤ Mcrc)' }
      : acrcLong <= limitLong
        ? { pass: true, message: `acrc dài hạn = ${acrcLong.toFixed(3)} ≤ ${limitLong} mm` }
        : { pass: false, message: `acrc dài hạn = ${acrcLong.toFixed(3)} > ${limitLong} mm` };

  if (As < 1) warnings.push('As chịu kéo quá nhỏ để kiểm tra nứt');
  if (Mshort <= 0 && Mlong <= 0) warnings.push('Chưa nhập moment sử dụng (SLS)');

  const pass = checkShort.pass && checkLong.pass;

  return {
    Ared: safe(Ared),
    yt: safe(yt),
    Ired1: safe(Ired1),
    Wred: safe(Wred),
    Wpl: safe(Wpl),
    Mcrc: safe(Mcrc),
    cracked,
    yc: safe(yc),
    Ired2: safe(Ired2),
    Ls: safe(Ls),
    acrcShort,
    acrcLong,
    limitShort,
    limitLong,
    checkShort,
    checkLong,
    pass,
    warnings,
  };
}
