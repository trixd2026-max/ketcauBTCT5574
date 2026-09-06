/** Material values transcribed from Beam.xlsm/Data. Units: MPa, mm. */
export type Concrete = { name: string; Rb: number; Rbt: number; RbtSer: number; Eb: number };
export type Steel = { name: string; Rs: number; Rsc: number; Rsw: number; Es: number };

export const concretes: Concrete[] = [
  ['B15', 8.5, 0.75, 1.1, 24000], ['B20', 11.5, 0.9, 1.35, 27500],
  ['B22.5', 13, 1, 1.45, 28500], ['B25', 14.5, 1.05, 1.55, 30000],
  ['B30', 17, 1.15, 1.75, 32500], ['B35', 19.5, 1.3, 1.95, 34500],
  ['B40', 22, 1.4, 2.1, 36000], ['B45', 25, 1.5, 2.25, 37000],
  ['B50', 27.5, 1.6, 2.45, 38000], ['B55', 30, 1.7, 2.6, 39000], ['B60', 33, 1.8, 2.75, 39500],
].map(([name, Rb, Rbt, RbtSer, Eb]) => ({ name: String(name), Rb: Number(Rb), Rbt: Number(Rbt), RbtSer: Number(RbtSer), Eb: Number(Eb) }));

export const steels: Steel[] = [
  ['CB240-T', 210, 210, 170], ['CB300-T', 260, 260, 210], ['CB300-V', 260, 260, 210],
  ['CB400-V', 350, 350, 280], ['CB500-V', 435, 400, 300],
].map(([name, Rs, Rsc, Rsw]) => ({ name: String(name), Rs: Number(Rs), Rsc: Number(Rsc), Rsw: Number(Rsw), Es: 200000 }));

export const getConcrete = (name: string) => concretes.find((x) => x.name === name) ?? concretes[3];
export const getSteel = (name: string) => steels.find((x) => x.name === name) ?? steels[3];
