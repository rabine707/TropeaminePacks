import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mergeRequests} from './requests.ts';
import type {RequestBook} from './catalog';
const base={title:'Book',author:'Author',genre:'Fantasy',tags:'',status:'Requested',approved:true};
test('merge preserves unique characters, combines demand, and prevents a duplicate personal vote',()=>{
 const requests:RequestBook[]=[{...base,id:'a',characters:[{name:'Mira',sfw:4,adult:2}]},{...base,id:'b',characters:[{name:'MIRA',sfw:3,adult:1},{name:'Rowan',sfw:1,adult:0}]}];
 const result=mergeRequests(requests,['a:Mira:sfw','b:MIRA:sfw','b:Rowan:sfw'],'b','a');
 assert.equal(result.requests.length,1);assert.deepEqual(result.requests[0].characters,[{name:'Mira',sfw:6,adult:3},{name:'Rowan',sfw:1,adult:0}]);assert.deepEqual(result.votes,['a:Mira:sfw','a:Rowan:sfw']);
 assert.equal(requests[0].characters[0].sfw,4);
});
test('merge rejects nonexistent or identical targets',()=>{assert.throws(()=>mergeRequests([],[],'x','y'));const r={...base,id:'a',characters:[]};assert.throws(()=>mergeRequests([r],[],'a','a'))});
