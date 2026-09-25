export type Wallet={ink:number;shards:number;owned:string[]};
export type PoolCard={id:string;rarity:string;available:boolean;adult?:boolean};
export function openPack(wallet:Wallet,cards:PoolCard[],random:()=>number=Math.random){
 const pool=cards.filter(c=>c.available&&!c.adult),better=pool.filter(c=>c.rarity!=='Common');
 if(wallet.ink<100)throw new Error('You need 100 Ink to open this pack.');
 if(!pool.length||!better.length)throw new Error('This pack is not available yet.');
 const owned=new Set(wallet.owned);let shards=wallet.shards;
 const pulls=Array.from({length:5},(_,i)=>{const p=i===4?better:pool;const c=p[Math.min(p.length-1,Math.floor(random()*p.length))];const duplicate=owned.has(c.id);if(duplicate)shards+=10;else owned.add(c.id);return {id:c.id,duplicate};});
 return {wallet:{ink:wallet.ink-100,shards,owned:[...owned]},pulls};
}
export function craft(wallet:Wallet,id:string){if(wallet.owned.includes(id))throw new Error('Already collected.');if(wallet.shards<30)throw new Error('Collect 30 Shards to craft this card.');return {...wallet,shards:wallet.shards-30,owned:[...wallet.owned,id]};}
