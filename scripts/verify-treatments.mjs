import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
// Start agent-browser, open Felicity's detail dialog, then pass its CDP URL.
const output = process.argv[3];
if(output) fs.mkdirSync(output,{recursive:true});
const socket = new WebSocket(process.argv[2]);
await new Promise(resolve => socket.addEventListener('open', resolve, {once:true}));
let seq=0, session; const pending=new Map(); const errors=[];
socket.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.id){const p=pending.get(data.id);pending.delete(data.id);data.error?p.reject(data.error):p.resolve(data.result)}else if(data.method==='Runtime.exceptionThrown')errors.push(data.params.exceptionDetails.text)});
function send(method,params={},attached=true){return new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params,...(attached&&session?{sessionId:session}:{})}))})}
const {targetInfos}=await send('Target.getTargets',{},false);
const target=targetInfos.find(t=>t.type==='page' && /^http:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(t.url));assert(target);
session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},false)).sessionId;
await send('Runtime.enable');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value}
async function select(name){await evaluate(`[...document.querySelectorAll('.treatment-option')].find(b=>b.querySelector('span').textContent===${JSON.stringify(name)}).click()`);await wait(100)}
async function state(){return evaluate(`(()=>{const e=document.querySelector('.physical-card');const b=e.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,rx:parseFloat(e.style.getPropertyValue('--rx')||'0'),ry:parseFloat(e.style.getPropertyValue('--ry')||'0'),lx:parseFloat(e.style.getPropertyValue('--lx')||'50'),energy:parseFloat(e.style.getPropertyValue('--energy')||'0'),transform:getComputedStyle(e.firstElementChild).transform,touch:getComputedStyle(e).touchAction}})()`)}
async function shot(name){const {data}=await send('Page.captureScreenshot',{format:'png'});if(output) fs.writeFileSync(path.join(output,`${name}.png`),Buffer.from(data,'base64'))}
await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
await evaluate('document.querySelector("dialog").scrollTop=0');
const imageBefore=await evaluate('document.querySelector("dialog img").src');
for(const name of ['Holo','Heartthrob','Unhinged','Slow Burn','Aftercare']){
 await select(name);const b=await state();
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:b.x+b.width*.2,y:b.y+b.height*.35});await wait(650);const left=await state();assert(left.ry<-5 && left.lx<35,`${name}: left light/tilt`);
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:b.x+b.width*.8,y:b.y+b.height*.6});await wait(650);const right=await state();assert(right.ry>5 && right.lx>65,`${name}: right light/tilt`);
 assert.equal(await evaluate('document.querySelector("dialog img").src'),imageBefore);
 assert(await evaluate('document.querySelector("dialog img").naturalWidth>0'));
 await shot(`desktop-${name.toLowerCase().replaceAll(' ','-')}`);
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:1200,y:40});await wait(900);assert((await state()).energy<.01);
 console.log(`PASS desktop ${name}: linked light/tilt, original art, exit reset`);
}
await select('Heartthrob');await evaluate('document.querySelector(".physical-card").focus()');
await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight'});await wait(400);assert((await state()).ry>2);
await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Home',code:'Home'});await wait(700);assert((await state()).energy<.01);
await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight'});await wait(500);
assert.equal((await state()).transform,'none');assert.equal(await evaluate('getComputedStyle(document.querySelector(".physical-card__material")).animationName'),'none');
console.log('PASS keyboard and reduced motion');
await send('Emulation.setEmulatedMedia',{features:[]});
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
async function touch(type,x,y){await send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'||type==='touchCancel'?[]:[{x,y,id:1}]})}
for(const name of ['Holo','Heartthrob','Unhinged','Slow Burn','Aftercare']){
 await select(name);await evaluate('document.querySelector("dialog").scrollTop=0');await wait(150);const b=await state();const y=b.y+b.height*.42;
 assert(b.touch.includes('pan-y')&&b.touch.includes('pinch-zoom'));
 await touch('touchStart',b.x+b.width*.25,y);await touch('touchMove',b.x+b.width*.75,y);await wait(500);assert((await state()).ry>3,`${name}: touch tilt`);
 await shot(`mobile-${name.toLowerCase().replaceAll(' ','-')}`);
 await touch('touchEnd');await wait(900);assert((await state()).energy<.01,`${name}: release reset`);
 await touch('touchStart',b.x+b.width*.25,y);await touch('touchMove',b.x+b.width*.65,y);await touch('touchCancel');await wait(900);assert((await state()).energy<.01,`${name}: cancel reset`);
 console.log(`PASS mobile ${name}: native touch drag, release, cancel`);
}
await select('Heartthrob');await evaluate('document.querySelector("dialog").scrollTop=0');const b=await state();
await touch('touchStart',b.x+b.width*.5,b.y+b.height*.7);
for(let i=1;i<=6;i++){await touch('touchMove',b.x+b.width*.5,b.y+b.height*.7-i*24);await wait(35)}
await touch('touchEnd');await wait(900);assert(await evaluate('document.querySelector("dialog").scrollTop>30'));assert((await state()).energy<.01);
console.log('PASS mobile vertical scrolling cancels tilt cleanly');
await select('Base');assert.equal(await evaluate('document.querySelectorAll(".physical-card").length'),0);
assert.equal(await evaluate('document.querySelectorAll(".treatment-overlay").length'),0);
assert.deepEqual(errors,[]);console.log('PASS base, no legacy overlay, no runtime exceptions');socket.close();
