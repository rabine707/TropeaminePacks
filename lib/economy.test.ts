import {test} from 'node:test';import assert from 'node:assert/strict';import {openPack,craft} from './economy.ts';
const cards=[{id:'a',rarity:'Common',available:true},{id:'b',rarity:'Uncommon',available:true},{id:'adult',rarity:'Rare',available:true,adult:true}];
test('five pulls, guaranteed uncommon, repeated pulls convert to shards, adult excluded',()=>{const r=openPack({ink:100,shards:0,owned:[]},cards,()=>0);assert.equal(r.pulls.length,5);assert.equal(r.pulls[4].id,'b');assert.equal(r.wallet.shards,30);assert.deepEqual(r.wallet.owned,['a','b']);assert.equal(r.wallet.ink,0)});
test('insufficient funds and invalid pools are rejected',()=>{assert.throws(()=>openPack({ink:99,shards:0,owned:[]},cards));assert.throws(()=>openPack({ink:100,shards:0,owned:[]},[]))});
test('craft spends shards once',()=>{const w=craft({ink:0,shards:30,owned:[]},'a');assert.equal(w.shards,0);assert.throws(()=>craft(w,'a'));assert.throws(()=>craft(w,'b'))});
