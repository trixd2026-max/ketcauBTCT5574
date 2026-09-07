/** Material values transcribed from Beam.xlsm/Data. Units: MPa, mm. */
export type Concrete = {
  name: string;
  Rb: number;
  Rbt: number;
  RbSer: number;
  RbtSer: number;
  Eb: number;
  /** Creep coefficient φb by humidity class: high (>75), mid (40-75), low (<40) */
  phiB: { high: number; mid: number; low: number };
};

export type Steel = { name: string; Rs: number; Rsc: number; Rsw: number; Es: number };

export type Humidity = 'high' | 'mid' | 'low';

export const concretes: Concrete[] = [
  // name, Rb, Rbt, RbSer, RbtSer, Eb, phi high/mid/low
  ['B15', 8.5, 0.75, 11, 1.1, 24000, 2.4, 3.4, 4.8],
  ['B20', 11.5, 0.9, 15, 1.35, 27500, 2.0, 2.8, 4.0],
  ['B22.5', 13, 1, 16.5, 1.45, 28500, 1.9, 2.65, 3.8],
  ['B25', 14.5, 1.05, 18.5, 1.55, 30000, 1.8, 2.5, 3.6],
  ['B30', 17, 1.15, 22, 1.75, 32500, 1.6, 2.3, 3.2],
  ['B35', 19.5, 1.3, 25.5, 1.95, 34500, 1.5, 2.1, 3.0],
  ['B40', 22, 1.4, 29, 2.1, 36000, 1.4, 1.9, 2.8],
  ['B45', 25, 1.5, 32, 2.25, 37000, 1.3, 1.8, 2.6],
  ['B50', 27.5, 1.6, 36, 2.45, 38000, 1.2, 1.6, 2.4],
  ['B55', 30, 1.7, 39.5, 2.6, 39000, 1.1, 1.5, 2.2],
  ['B60', 33, 1.8, 43, 2.75, 39500, 1.0, 1.4, 2.0],
].map(([name, Rb, Rbt, RbSer, RbtSer, Eb, ph, pm, pl]) => ({
  name: String(name),
  Rb: Number(Rb),
  Rbt: Number(Rbt),
  RbSer: Number(RbSer),
  RbtSer: Number(RbtSer),
  Eb: Number(Eb),
  phiB: { high: Number(ph), mid: Number(pm), low: Number(pl) },
}));

export const steels: Steel[] = [
  ['CB240-T', 210, 210, 170],
  ['CB300-T', 260, 260, 210],
  ['CB300-V', 260, 260, 210],
  ['CB400-V', 350, 350, 280],
  ['CB500-V', 435, 400, 300],
].map(([name, Rs, Rsc, Rsw]) => ({
  name: String(name),
  Rs: Number(Rs),
  Rsc: Number(Rsc),
  Rsw: Number(Rsw),
  Es: 200000,
}));

export const getConcrete = (name: string) => concretes.find((x) => x.name === name) ?? concretes[3];
export const getSteel = (name: string) => steels.find((x) => x.name === name) ?? steels[3];

/** εb1,red short-term / long-term (typical from workbook) */
export const EB1_RED_SHORT = 0.0015;
export const EB1_RED_LONG = 0.0028;

/** Crack width limits (mm) — typical indoor/non-aggressive from workbook */
export const ACRC_LIMIT_SHORT = 0.4;
export const ACRC_LIMIT_LONG = 0.3;
