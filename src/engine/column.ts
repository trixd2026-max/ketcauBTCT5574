/**
 * Column (Cột) V1.1 — aligned with Column.xlsm (Column_Design, ThepDai, Data_Column).
 * Units: mm, MPa, kN, kNm
 * N–M interaction is APPROXIMATE (Excel FS comes from VBA macro) — not TCVN-locked.
 */
import { getConcrete, getSteel } from './materials';

export type ColumnInput = {
  id: string;
  name: string;
  b: number;
  h: number;
  L0x: number;
  L0y: number;
  N: number;
  Mx: number;
  My: number;
  Qx?: number;
  Qy?: number;
  concrete: string;
  steel: string;
  stirrupSteel: string;
  bars?: string;
  As?: number;
  nBars?: number;
  barDia?: number;
  cover: number;
  gammaB?: number;
  stirrupDia: number;
  stirrupSpacing: number;
  stirrupLegsX: number;
  stirrupLegsY: number;
};

export type Check = { pass: boolean; message: string };

export type ColumnResult = {
  Ab: number;
  As: number;
  mu: number;
  muMin: number;
  muMax: number;
  lambdaX: number;
  lambdaY: number;
  lambdaMax: number;
  lambdaLimit: number;
  N0: number;
  Mx0: number;
  My0: number;
  interaction: number;
  alpha: number;
  vd: number;
  vdLimit: number;
  fcd: number;
  shearX: { qDemand: number; qbt: number; qRes: number; phiN: number; check: Check };
  shearY: { qDemand: number; qbt: number; qRes: number; phiN: number; check: Check };
  checks: {
    slenderness: Check;
    mu: Check;
    interaction: Check;
    compressionRatio: Check;
    detailing: Check;
  };
  pass: boolean;
  warnings: string[];
};

const safe = (v: number) => (Number.isFinite(v) ? v : 0);
const check = (pass: boolean, message: string): Check => ({ pass, message });

export function parseColumnBars(spec: string): { As: number; n: number; dia: number; ok: boolean } {
  const s = (spec || '').trim().toLowerCase().replace(/ø|ф/g, 'd');
  if (!s) return { As: 0, n: 0, dia: 0, ok: false };
  const re = /([0-9]+)[ x*×+;]*d([0-9]+(?:[.][0-9]+)?)/gi;
  let m: RegExpExecArray | null;
  let As = 0;
  let n = 0;
  let maxDia = 0;
  let found = false;
  while ((m = re.exec(s)) !== null) {
    found = true;
    const count = Number(m[1]);
    const dia = Number(m[2]);
    if (!count || !dia) continue;
    As += (count * Math.PI * dia * dia) / 4;
    n += count;
    if (dia > maxDia) maxDia = dia;
  }
  return { As: Math.round(As * 10) / 10, n, dia: maxDia, ok: found && As > 0 };
}

function uniaxialMu(
  N: number,
  b: number,
  h: number,
  As: number,
  a: number,
  Rb: number,
  Rsc: number,
  _Rs: number
): number {
  const Ab = b * h;
  const ho = h - a;
  if (ho <= 0 || b <= 0) return 0;
  const N0 = Rb * Ab + Rsc * As;
  const Nabs = Math.abs(N);
  if (Nabs >= N0) return 0;
  return Math.max(0.35 * N0 * h * (1 - Nabs / Math.max(N0, 1)), 0);
}

function phiNFromSm(sm: number, Rb: number): number {
  if (sm < 0) return 1;
  if (sm <= 0.25 * Rb) return 1 + sm / Math.max(Rb, 1e-6);
  if (sm <= 0.75 * Rb) return 1.25;
  return 1.25;
}

export function calcColumn(input: ColumnInput): ColumnResult {
  const c = getConcrete(input.concrete);
  const s = getSteel(input.steel);
  const st = getSteel(input.stirrupSteel);
  const gammaB = input.gammaB ?? 0.85;
  const Rb = c.Rb * gammaB;

  const b = input.b;
  const h = input.h;
  const Ab = b * h;
  const a = input.cover + (input.barDia ?? 20) / 2;

  const parsed = parseColumnBars(input.bars ?? '');
  const As = parsed.ok ? parsed.As : (input.As ?? 0);
  const barDia = parsed.ok ? parsed.dia : (input.barDia ?? 20);
  const nBars = parsed.ok ? parsed.n : (input.nBars ?? 4);

  const mu = Ab > 0 ? (As * 100) / Ab : 0;
  const muMin = 1.0;
  const muMax = 5.0;

  const ix = b / Math.sqrt(12);
  const iy = h / Math.sqrt(12);
  const lambdaX = ix > 0 ? input.L0x / ix : 0;
  const lambdaY = iy > 0 ? input.L0y / iy : 0;
  const lambdaMax = Math.max(lambdaX, lambdaY);
  const lambdaLimit = 100;

  const N = Math.abs(input.N);
  const Mx = Math.abs(input.Mx);
  const My = Math.abs(input.My);
  const N_N = N * 1000;

  const N0 = (Rb * Ab + s.Rsc * As) / 1000;

  const Mx0 = uniaxialMu(N_N, b, h, As, a, Rb, s.Rsc, s.Rs) / 1e6;
  const My0 = uniaxialMu(N_N, h, b, As, a, Rb, s.Rsc, s.Rs) / 1e6;

  const nRel = N0 > 0 ? N / N0 : 0;
  const alpha = nRel < 0.1 ? 1.0 : nRel > 0.7 ? 2.0 : 1.5;
  const rx = Mx0 > 1e-6 ? Mx / Mx0 : Mx > 0 ? 99 : 0;
  const ry = My0 > 1e-6 ? My / My0 : My > 0 ? 99 : 0;
  const interaction = Math.pow(rx, alpha) + Math.pow(ry, alpha);

  const fcd = c.Rb * 1.2;
  const vd = b * h > 0 ? (N * 1000) / (fcd * b * h) : 0;
  const vdLimit = 0.65;

  const sm = Ab > 0 ? (N * 1000) / Ab : 0;
  const phiN = phiNFromSm(sm, c.Rb);

  const calcShear = (Q: number, width: number, depth: number, legs: number) => {
    const ho = Math.max(depth - a, 1);
    const qDemand = Math.abs(Q);
    const phiB1 = 0.3;
    const qbt = (phiB1 * c.Rb * width * ho) / 1000;

    const Asw = legs * (Math.PI * input.stirrupDia ** 2) / 4;
    const Rsw = input.stirrupDia >= 10 ? s.Rsw : st.Rsw;
    const qsw = input.stirrupSpacing > 0 ? (Rsw * Asw) / input.stirrupSpacing : 0;

    const phiB2 = 1.5;
    const qBraw = (phiN * phiB2 * c.Rbt * width * ho) / 1000;
    const qBmin = (0.5 * c.Rbt * width * ho) / 1000;
    const qBmax = (2.5 * c.Rbt * width * ho) / 1000;
    const qB = Math.min(Math.max(qBraw, qBmin), qBmax);

    const phiSw = 0.75;
    const qSw = (phiSw * qsw * ho) / 1000;
    const qRes = qB + qSw;

    const passBt = qDemand <= qbt + 1e-6;
    const passRes = qDemand <= qRes + 1e-6;
    const pass = passBt && passRes;
    const msg = pass
      ? `Q=${qDemand.toFixed(1)} ≤ Qbt=${qbt.toFixed(1)} & Qb+Qsw=${qRes.toFixed(1)} (φn=${phiN.toFixed(2)})`
      : `Cắt KĐ: Q=${qDemand.toFixed(1)} > min(Qbt=${qbt.toFixed(1)}, Qb+Qsw=${qRes.toFixed(1)})`;
    return { qDemand, qbt, qRes, phiN, check: check(pass, msg) };
  };

  const shearX = calcShear(input.Qx ?? 0, b, h, input.stirrupLegsX);
  const shearY = calcShear(input.Qy ?? 0, h, b, input.stirrupLegsY);

  const slenderness = check(
    lambdaMax <= lambdaLimit,
    lambdaMax <= lambdaLimit
      ? `λmax=${lambdaMax.toFixed(1)} ≤ ${lambdaLimit}`
      : `λmax=${lambdaMax.toFixed(1)} > ${lambdaLimit}`
  );
  const muCheck = check(
    mu >= muMin && mu <= muMax && nBars >= 4,
    mu >= muMin && mu <= muMax && nBars >= 4
      ? `μ=${mu.toFixed(2)}% ∈ [${muMin}, ${muMax}], n=${nBars}≥4`
      : `μ=${mu.toFixed(2)}% hoặc n=${nBars} không đạt (min ${muMin}%, ≥4 thanh)`
  );
  const interactionCheck = check(
    interaction <= 1.0 && N <= N0,
    interaction <= 1.0 && N <= N0
      ? `Tương tác N–M ≈ ${interaction.toFixed(3)} ≤ 1 (α=${alpha}) — gần đúng`
      : `Tương tác N–M ≈ ${interaction.toFixed(3)} > 1 hoặc N=${N.toFixed(0)} > N0=${N0.toFixed(0)}`
  );
  const compressionRatio = check(
    vd <= vdLimit,
    vd <= vdLimit ? `vd=${vd.toFixed(3)} ≤ ${vdLimit}` : `vd=${vd.toFixed(3)} > ${vdLimit}`
  );
  const detailing = check(
    input.cover >= 25 && input.stirrupDia >= 6 && input.stirrupSpacing > 0 && nBars >= 4,
    input.cover >= 25 && input.stirrupDia >= 6 && nBars >= 4
      ? 'Cấu tạo cơ bản đạt (cover≥25, đai Ø≥6, ≥4 thanh)'
      : 'Cấu tạo: cover≥25, đai Ø≥6, ≥4 thanh dọc'
  );

  const warnings: string[] = [];
  if (!slenderness.pass) warnings.push(slenderness.message);
  if (!muCheck.pass) warnings.push(muCheck.message);
  if (!interactionCheck.pass) warnings.push(interactionCheck.message);
  if (!compressionRatio.pass) warnings.push(compressionRatio.message);
  if (!shearX.check.pass) warnings.push(`Qx: ${shearX.check.message}`);
  if (!shearY.check.pass) warnings.push(`Qy: ${shearY.check.message}`);
  if (!detailing.pass) warnings.push(detailing.message);
  warnings.push(
    'Cột V1.1: biểu đồ tương tác N–M là gần đúng (Excel FS từ macro VBA) — chưa khóa chuẩn TCVN 5574 / Column.xlsm'
  );

  const pass =
    slenderness.pass &&
    muCheck.pass &&
    interactionCheck.pass &&
    compressionRatio.pass &&
    detailing.pass &&
    shearX.check.pass &&
    shearY.check.pass;

  return {
    Ab,
    As,
    mu,
    muMin,
    muMax,
    lambdaX: safe(lambdaX),
    lambdaY: safe(lambdaY),
    lambdaMax: safe(lambdaMax),
    lambdaLimit,
    N0: safe(N0),
    Mx0: safe(Mx0),
    My0: safe(My0),
    interaction: safe(interaction),
    alpha,
    vd: safe(vd),
    vdLimit,
    fcd: safe(fcd),
    shearX,
    shearY,
    checks: { slenderness, mu: muCheck, interaction: interactionCheck, compressionRatio, detailing },
    pass,
    warnings,
  };
}

export const createDefaultColumn = (id: string = crypto.randomUUID()): ColumnInput => ({
  id,
  name: 'Cột mới',
  b: 300,
  h: 600,
  L0x: 3040,
  L0y: 3040,
  N: 1200,
  Mx: 90,
  My: 50,
  Qx: 80,
  Qy: 60,
  concrete: 'B25',
  steel: 'CB500-V',
  stirrupSteel: 'CB240-T',
  bars: '12d20',
  cover: 30,
  gammaB: 0.85,
  stirrupDia: 10,
  stirrupSpacing: 200,
  stirrupLegsX: 2,
  stirrupLegsY: 2,
});
