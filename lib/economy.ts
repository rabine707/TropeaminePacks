export type Wallet={ink:number;shards:number;owned:string[]};
export type PoolCard={id:string;rarity:string;available:boolean;adult?:boolean};
export type PackPull={id:string;duplicate:boolean;foil?:boolean};
export function openPack(wallet:Wallet,cards:PoolCard[],random:()=>number=Math.random){
 const pool=cards.filter(c=>c.available&&!c.adult);
 if(wallet.ink<100)throw new Error('You need 100 Ink to open this pack.');
 if(pool.length<4)throw new Error('This pack needs at least 4 unique cards before it can be opened.');
 const ownedBefore=new Set(wallet.owned),owned=new Set(wallet.owned),pulled=new Set<string>();let shards=wallet.shards;
 const pick=(source:PoolCard[])=>{const available=source.filter(c=>!pulled.has(c.id));if(!available.length)throw new Error('Not enough unique cards are available for this pack.');return available[Math.min(available.length-1,Math.floor(random()*available.length))]};
 const pulls:PackPull[]=[];
 for(let i=0;i<4;i++){const card=pick(pool);pulled.add(card.id);const duplicate=ownedBefore.has(card.id);if(duplicate)shards+=10;else owned.add(card.id);pulls.push({id:card.id,duplicate});}
 const foil=pool[Math.min(pool.length-1,Math.floor(random()*pool.length))];
 const foilKey=`${foil.id}:foil`,foilDuplicate=ownedBefore.has(foilKey);
 if(foilDuplicate)shards+=10;else owned.add(foilKey);
 pulls.push({id:foil.id,duplicate:foilDuplicate,foil:true});
 return {wallet:{ink:wallet.ink-100,shards,owned:[...owned]},pulls};
}
export function craft(wallet:Wallet,id:string){if(wallet.owned.includes(id))throw new Error('Already collected.');if(wallet.shards<30)throw new Error('Collect 30 Shards to craft this card.');return {...wallet,shards:wallet.shards-30,owned:[...wallet.owned,id]};}
