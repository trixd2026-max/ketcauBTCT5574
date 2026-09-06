export type Concrete={name:string,Rb:number,Rbt:number,Eb:number};
export type Steel={name:string,Rs:number,Es:number};
export const concretes:Concrete[]=[15,20,25,30,35,40,45,50,55,60].map(n=>({name:`B${n}`,Rb:n===25?14.5:n*0.58,Rbt:n===25?1.05:n*0.042,Eb: n===25?30000:27000+n*500}));
export const steels:Steel[]=[['CB240-T',210],['CB300-T',260],['CB300-V',260],['CB400-V',350],['CB500-V',435]].map(([name,Rs])=>({name:String(name),Rs:Number(Rs),Es:200000}));
export const getConcrete=(name:string)=>concretes.find(x=>x.name===name)??concretes[2];
export const getSteel=(name:string)=>steels.find(x=>x.name===name)??steels[3];
