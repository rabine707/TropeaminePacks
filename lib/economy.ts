export type Wallet={ink:number;shards:number;owned:string[]};
export type PoolCard={id:string;rarity:string;available:boolean;adult?:boolean};
export type PackPull={id:string;duplicate:boolean;foil?:boolean};
export const PACK_COST=100;
export const BASE_PULL_COUNT=3;
export const TOTAL_PULL_COUNT=4;
export const DUPLICATE_SHARDS=5;
export function openPack(wallet:Wallet,cards:PoolCard[],random:()=>number=Math.random){
 const pool=cards.filter(c=>c.available&&!c.adult);
 if(wallet.ink<PACK_COST)throw new Error(`You need ${PACK_COST} Ink to open this pack.`);
 if(pool.length<BASE_PULL_COUNT)throw new Error(`This pack needs at least ${BASE_PULL_COUNT} unique cards before it can be opened.`);
 const ownedBefore=new Set(wallet.owned),owned=new Set(wallet.owned),pulled=new Set<string>();let shards=wallet.shards;
 const pick=(source:PoolCard[])=>{const available=source.filter(c=>!pulled.has(c.id));if(!available.length)throw new Error('Not enough unique cards are available for this pack.');return available[Math.min(available.length-1,Math.floor(random()*available.length))]};
 const pulls:PackPull[]=[];
 for(let i=0;i<BASE_PULL_COUNT;i++){const card=pick(pool);pulled.add(card.id);const duplicate=ownedBefore.has(card.id);if(duplicate)shards+=DUPLICATE_SHARDS;else owned.add(card.id);pulls.push({id:card.id,duplicate});}
 const foil=pool[Math.min(pool.length-1,Math.floor(random()*pool.length))];
 const foilKey=`${foil.id}:foil`,foilDuplicate=ownedBefore.has(foilKey);
 if(foilDuplicate)shards+=DUPLICATE_SHARDS;else owned.add(foilKey);
 pulls.push({id:foil.id,duplicate:foilDuplicate,foil:true});
 return {wallet:{ink:wallet.ink-PACK_COST,shards,owned:[...owned]},pulls};
}