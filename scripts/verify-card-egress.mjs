import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
// Start agent-browser on the local app, then pass its browser CDP URL.
// Uses the free guest demo only; never spends Ink or writes to a cloud collection.
const origin=process.argv[3]||'http://127.0.0.1:3128';const output=process.argv[4];if(output)fs.mkdirSync(output,{recursive:true});
const socket=new WebSocket(process.argv[2]);await new Promise(r=>socket.addEventListener('open',r,{once:true}));let seq=0,session;const pending=new Map(),errors=[];
socket.addEventListener('message',e=>{const d=JSON.parse(e.data);if(d.id){const p=pending.get(d.id);pending.delete(d.id);d.error?p.reject(d.error):p.resolve(d.result)}else if(d.method==='Runtime.exceptionThrown')errors.push(d.params.exceptionDetails.text)});
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params,...(session?{sessionId:session}:{})}))});
const {targetInfos}=await send('Target.getTargets');const target=targetInfos.find(t=>t.type==='page'&&t.url.startsWith(origin));session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true})).sessionId;await send('Runtime.enable');
const ev=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const ready=async()=>{for(let i=0;i<100;i++){if(await ev('[...document.querySelectorAll("dialog .card-art img")].every(i=>i.complete&&i.naturalWidth>0)'))return;await wait(100)}throw Error('image load timed out')};
const click=async()=>{await ev('document.querySelector(".cinematic-card-stage").click()');await wait(650);await ready()};
const state=()=>ev('({stage:document.querySelector(".cinematic-card-stage")?.className,images:[...document.querySelectorAll("dialog .card-art img")].map(i=>({src:i.src,width:i.naturalWidth})),foil:!!document.querySelector(".face-front .cinematic-front-face.pack-foil-pull .foil-badge")})');
await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
await send('Emulation.setTouchEmulationEnabled',{enabled:false});
await send('Page.navigate',{url:origin+'/packs'});
for(let i=0;i<100;i++){if(await ev('[...document.querySelectorAll("button")].some(b=>b.textContent.includes("Open free demo pack")&&!b.disabled)'))break;await wait(100)}
assert(await ev('[...document.querySelectorAll("button")].some(b=>b.textContent.includes("Open free demo pack")&&!b.disabled)'), 'Use a guest browser session with a live card pool');
await ev('performance.clearResourceTimings();[...document.querySelectorAll("button")].find(b=>b.textContent.includes("Open free demo pack")).click()');await wait(500);
await ready();assert((await state()).stage.includes('face-mystery'));assert.equal((await state()).images.length,1);
for(let slot=0;slot<5;slot++){
 assert((await state()).stage.includes('face-mystery'));assert.equal((await state()).images.length,1);
 await click();let front=await state();assert(front.stage.includes('face-front'));assert.equal(front.images.length,2);assert(front.images.every(i=>i.src.endsWith('size=original')));
 if(slot===4){assert(front.foil);const shot=await send('Page.captureScreenshot',{format:'png'});if(output)fs.writeFileSync(path.join(output,'foil-reveal.png'),Buffer.from(shot.data,'base64'))}
 await click();assert((await state()).stage.includes('face-back'));await click();
}
assert.equal(await ev('document.querySelectorAll(".recap-grid .reveal-card").length'),5);
console.log('PASS five mystery/front/back sequences, full originals, fifth-card foil, recap');
await ev('document.querySelector("dialog .close").click()');await ev('performance.clearResourceTimings();[...document.querySelectorAll("button")].find(b=>b.textContent.includes("Open free demo pack")).click()');await wait(1000);await ready();
await ev('document.querySelector(".reveal-all").click()');await wait(1000);
const requests=await ev('performance.getEntriesByType("resource").filter(r=>r.name.includes("/api/card-art/")).map(r=>({url:r.name,bytes:r.transferSize}))');assert(requests.every(r=>!r.url.includes('-back.')));console.log('PASS reveal-all does not fetch dossier backs');
await ev('document.querySelector(".recap-grid .reveal-card").click()');await wait(500);await ready();
assert(await ev('document.querySelector(".detail-layout img").src.endsWith("size=original")'));console.log('PASS recap opens full-quality detail');
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await wait(300);await ready();
const shot=await send('Page.captureScreenshot',{format:'png'});if(output)fs.writeFileSync(path.join(output,'mobile-original.png'),Buffer.from(shot.data,'base64'));
assert.deepEqual(errors,[]);console.log('PASS mobile detail and no runtime exceptions');socket.close();
