import {getConcrete,getSteel} from './materials';
export type BeamInput={b:number;h:number;a:number;M:number;Q:number;concrete:string;steel:string;AsProvided:number};
export type BeamResult={ho:number;alphaM:number;xi:number;xiR:number;AsRequired:number;mu:number;flexure:boolean;Qbt:number;shear:boolean};
export function calcBeam(x:BeamInput):BeamResult{
 const c=getConcrete(x.concrete),s=getSteel(x.steel),ho=x.h-x.a;
 const denom=x.b*ho*ho*c.Rb;
 const alphaM=Math.max(0,Math.abs(x.M)*1e6/denom);
 const xi=alphaM>=0.5?1:1-Math.sqrt(1-2*alphaM);
 const xiR=0.8/(1+(s.Rs/s.Es)/0.0035);
 const AsRequired=c.Rb*x.b*xi*ho/s.Rs;
 const mu=x.AsProvided*100/(x.b*ho);
 const flexure=xi<=xiR && x.AsProvided>=AsRequired && mu>=0.1;
 const Qbt=2.5*c.Rbt*x.b*ho;
 return {ho,alphaM,xi,xiR,AsRequired,mu,flexure,Qbt,shear:Math.abs(x.Q)<=Qbt};
}
