'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import {Download,Image as ImageIcon,Layers,Plus,RotateCw,Sparkles,Trash2,Type,Undo2} from 'lucide-react';
import type {Card} from '@/lib/catalog';

type CanvasPreset='story'|'square'|'landscape';
type BgPreset='plum'|'midnight'|'paper'|'rose';
type CardElement={id:string;kind:'card';cardId:string;side:'front'|'back';x:number;y:number;w:number;h:number;rotation:number;z:number};
type TextElement={id:string;kind:'text';text:string;x:number;y:number;size:number;rotation:number;z:number};
type DecoElement={id:string;kind:'deco';text:string;x:number;y:number;size:number;rotation:number;z:number};
type Element=CardElement|TextElement|DecoElement;
type SavedState={cards?:Card[];wallet?:{owned?:string[]};adultOptIn?:boolean};
type Draft={preset:CanvasPreset;bg:BgPreset;elements:Element[]};

const DRAFT_KEY='tropeamine-showcase-draft-v1';
const sizes:Record<CanvasPreset,{w:number;h:number;label:string}>={story:{w:1080,h:1920,label:'Story'},square:{w:1080,h:1080,label:'Square'},landscape:{w:1200,h:630,label:'Landscape'}};
const bgs:Record<BgPreset,{a:string;b:string;label:string}>={plum:{a:'#2a1025',b:'#7a2d63',label:'Plum'},midnight:{a:'#0c1017',b:'#283244',label:'Midnight'},paper:{a:'#efe4d0',b:'#cbb89d',label:'Parchment'},rose:{a:'#3a1620',b:'#9c526c',label:'Rose'}};

function uid(){return crypto.randomUUID()}
function clamp(n:number,min:number,max:number){return Math.min(max,Math.max(min,n))}

export default function ShowcaseStudio(){
 const canvasRef=useRef<HTMLCanvasElement>(null);
 const imageCache=useRef<Record<string,HTMLImageElement>>({});
 const [preset,setPreset]=useState<CanvasPreset>('story');
 const [bg,setBg]=useState<BgPreset>('plum');
 const [cards,setCards]=useState<Card[]>([]);
 const [owned,setOwned]=useState<string[]>([]);
 const [elements,setElements]=useState<Element[]>([]);
 const [selected,setSelected]=useState<string|null>(null);
 const [drag,setDrag]=useState<{id:string;dx:number;dy:number}|null>(null);
 const [notice,setNotice]=useState('');
 const [showMature,setShowMature]=useState(false);
 const [adultOptIn,setAdultOptIn]=useState(false);
 const dims=sizes[preset];
 const visibleCards=useMemo(()=>cards.filter(c=>owned.includes(c.id)).filter(c=>showMature||(!c.adult&&!c.tags?.includes('Mature Content'))),[cards,owned,showMature]);
 const selectedEl=elements.find(e=>e.id===selected)||null;

 useEffect(()=>{
  try{
   const raw=localStorage.getItem('tropeamine-packs-v1');
   if(raw){const parsed=JSON.parse(raw) as SavedState;setCards(Array.isArray(parsed.cards)?parsed.cards:[]);setOwned(Array.isArray(parsed.wallet?.owned)?parsed.wallet!.owned!.filter(id=>!id.includes(':')):[]);setAdultOptIn(Boolean(parsed.adultOptIn))}
   const draftRaw=localStorage.getItem(DRAFT_KEY);
   if(draftRaw){const draft=JSON.parse(draftRaw) as Draft;if(draft?.preset&&draft?.bg&&Array.isArray(draft.elements)){setPreset(draft.preset);setBg(draft.bg);setElements(draft.elements);setNotice('Your last showcase draft was restored.')}}
  }catch{}
 },[]);

 useEffect(()=>{try{localStorage.setItem(DRAFT_KEY,JSON.stringify({preset,bg,elements} satisfies Draft))}catch{}},[preset,bg,elements]);
 useEffect(()=>{draw()},[elements,bg,preset,cards,selected]);

 function cachedImage(src:string){
  const existing=imageCache.current[src];if(existing)return existing;
  const img=new Image();img.crossOrigin='anonymous';img.decoding='async';img.onload=()=>draw();img.src=src;imageCache.current[src]=img;return img;
 }

 function draw(){
  const canvas=canvasRef.current;if(!canvas)return;
  canvas.width=dims.w;canvas.height=dims.h;
  const ctx=canvas.getContext('2d');if(!ctx)return;
  const grad=ctx.createLinearGradient(0,0,dims.w,dims.h);grad.addColorStop(0,bgs[bg].a);grad.addColorStop(1,bgs[bg].b);ctx.fillStyle=grad;ctx.fillRect(0,0,dims.w,dims.h);
  ctx.fillStyle='rgba(255,255,255,.06)';for(let i=0;i<18;i++){ctx.beginPath();ctx.arc((i*137)%dims.w,(i*223)%dims.h,3+(i%5),0,Math.PI*2);ctx.fill()}
  for(const el of [...elements].sort((a,b)=>a.z-b.z)){
   ctx.save();ctx.translate(el.x,el.y);ctx.rotate(el.rotation*Math.PI/180);
   if(el.kind==='text'||el.kind==='deco'){
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=bg==='paper'?'#251a16':'#fff7ef';ctx.font=`700 ${el.size}px Georgia, serif`;ctx.fillText(el.text,0,0);ctx.restore();continue;
   }
   const card=cards.find(c=>c.id===el.cardId),src=el.side==='back'?card?.back:card?.image;
   if(src){const img=cachedImage(src);if(img.complete&&img.naturalWidth)ctx.drawImage(img,-el.w/2,-el.h/2,el.w,el.h);else{ctx.fillStyle='rgba(255,255,255,.12)';ctx.fillRect(-el.w/2,-el.h/2,el.w,el.h)}}else{ctx.fillStyle='rgba(255,255,255,.12)';ctx.fillRect(-el.w/2,-el.h/2,el.w,el.h)}
   ctx.restore();
  }
  const active=elements.find(e=>e.id===selected);
  if(active){ctx.save();ctx.translate(active.x,active.y);ctx.rotate(active.rotation*Math.PI/180);ctx.strokeStyle='rgba(255,255,255,.95)';ctx.lineWidth=Math.max(2,dims.w/500);const w=active.kind==='card'?active.w:Math.max(180,active.text.length*active.size*.55),h=active.kind==='card'?active.h:active.size*1.35;ctx.setLineDash([12,8]);ctx.strokeRect(-w/2,-h/2,w,h);ctx.restore()}
 }

 function addCard(card:Card){const z=Math.max(0,...elements.map(e=>e.z))+1,id=uid();setElements(v=>[...v,{id,kind:'card',cardId:card.id,side:'front',x:dims.w/2,y:dims.h/2,w:280,h:420,rotation:0,z}]);setSelected(id)}
 function addText(){const z=Math.max(0,...elements.map(e=>e.z))+1,id=uid();setElements(v=>[...v,{id,kind:'text',text:'My current obsessions',x:dims.w/2,y:140,size:64,rotation:0,z}]);setSelected(id)}
 function addDeco(text:string){const z=Math.max(0,...elements.map(e=>e.z))+1,id=uid();setElements(v=>[...v,{id,kind:'deco',text,x:dims.w/2,y:dims.h/2,size:72,rotation:0,z}]);setSelected(id)}
 function removeSelected(){if(!selected)return;setElements(v=>v.filter(e=>e.id!==selected));setSelected(null)}
 function updateSelected(patch:Record<string,unknown>){if(!selected)return;setElements(v=>v.map(e=>e.id===selected?({...e,...patch} as Element):e))}
 function toCanvasPoint(e:React.PointerEvent<HTMLCanvasElement>){const rect=e.currentTarget.getBoundingClientRect();return{x:(e.clientX-rect.left)*(dims.w/rect.width),y:(e.clientY-rect.top)*(dims.h/rect.height)}}
 function hitTest(x:number,y:number){return [...elements].sort((a,b)=>b.z-a.z).find(el=>{const dx=x-el.x,dy=y-el.y;if(el.kind==='card')return Math.abs(dx)<=el.w/2&&Math.abs(dy)<=el.h/2;return Math.hypot(dx,dy)<Math.max(90,el.size)})||null}
 function pointerDown(e:React.PointerEvent<HTMLCanvasElement>){const p=toCanvasPoint(e),hit=hitTest(p.x,p.y);setSelected(hit?.id||null);if(hit){e.currentTarget.setPointerCapture(e.pointerId);setDrag({id:hit.id,dx:p.x-hit.x,dy:p.y-hit.y})}}
 function pointerMove(e:React.PointerEvent<HTMLCanvasElement>){if(!drag)return;const p=toCanvasPoint(e);setElements(v=>v.map(el=>el.id===drag.id?{...el,x:clamp(p.x-drag.dx,0,dims.w),y:clamp(p.y-drag.dy,0,dims.h)}:el))}
 function pointerUp(){setDrag(null)}

 function applyTemplate(kind:'top6'|'hero'|'grid9'){
  const picks=visibleCards.slice(0,kind==='grid9'?9:6);if(!picks.length){setNotice('Collect a few cards first, then come back to build a showcase.');return}
  const next:Element[]=[];let z=1;
  if(kind==='hero'){
   next.push({id:uid(),kind:'card',cardId:picks[0].id,side:'front',x:dims.w/2,y:dims.h*.43,w:430,h:645,rotation:0,z:z++});
   picks.slice(1,5).forEach((c,i)=>next.push({id:uid(),kind:'card',cardId:c.id,side:'front',x:dims.w*.2+(i%2)*dims.w*.6,y:dims.h*.22+Math.floor(i/2)*dims.h*.48,w:210,h:315,rotation:i%2?-4:4,z:z++}));
  }else{
   const cols=kind==='grid9'?3:2,rows=Math.ceil(picks.length/cols),cw=kind==='grid9'?230:280,ch=cw*1.5;
   picks.forEach((c,i)=>{const col=i%cols,row=Math.floor(i/cols);next.push({id:uid(),kind:'card',cardId:c.id,side:'front',x:(col+1)*dims.w/(cols+1),y:(row+1)*dims.h/(rows+1),w:cw,h:ch,rotation:0,z:z++})});
  }
  const titleId=uid();next.push({id:titleId,kind:'text',text:'My current obsessions',x:dims.w/2,y:Math.max(74,dims.h*.07),size:58,rotation:0,z:z++});setElements(next);setSelected(titleId);setNotice('Template applied — everything is still draggable and editable.');
 }

 function exportPng(){
  const canvas=canvasRef.current;if(!canvas)return;setSelected(null);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{try{const link=document.createElement('a');link.download=`tropeamine-showcase-${Date.now()}.png`;link.href=canvas.toDataURL('image/png');link.click();setNotice('PNG exported.')}catch{setNotice('One of the selected images could not be exported. Try another card or reload the studio.')}}));
 }
 function clearCanvas(){setElements([]);setSelected(null);try{localStorage.removeItem(DRAFT_KEY)}catch{}setNotice('Canvas cleared.')}

 return <div className="studio-grid">
  <aside className="studio-panel left-panel">
   <section><h2>Start easy</h2><p className="studio-muted">Pick a layout, then move anything you want.</p><div className="template-grid"><button onClick={()=>applyTemplate('top6')}>Top 6</button><button onClick={()=>applyTemplate('hero')}>Hero + 4</button><button onClick={()=>applyTemplate('grid9')}>Grid 9</button></div></section>
   <section><h2><ImageIcon size={16}/> Your cards</h2><div className="card-picker">{visibleCards.length?visibleCards.map(c=><button key={c.id} onClick={()=>addCard(c)} title={`Add ${c.name}`}><span>{c.image?<img src={c.image} alt=""/>:<Plus/>}</span><small>{c.name}</small></button>):<p className="studio-muted">No collected cards found on this device yet.</p>}</div>{adultOptIn&&<label className="studio-check"><input type="checkbox" checked={showMature} onChange={e=>setShowMature(e.target.checked)}/>Include Mature Content cards</label>}</section>
   <section><h2><Plus size={16}/> Add</h2><div className="tool-row"><button onClick={addText}><Type size={16}/>Text</button><button onClick={()=>addDeco('♡')}>♡</button><button onClick={()=>addDeco('✦')}>✦</button><button onClick={()=>addDeco('☾')}>☾</button></div></section>
  </aside>

  <section className="studio-center">
   <div className="studio-toolbar"><div>{(Object.keys(sizes) as CanvasPreset[]).map(k=><button key={k} className={preset===k?'active':''} onClick={()=>setPreset(k)}>{sizes[k].label}</button>)}</div><div>{(Object.keys(bgs) as BgPreset[]).map(k=><button key={k} className={`swatch swatch-${k} ${bg===k?'active':''}`} onClick={()=>setBg(k)} aria-label={`${bgs[k].label} background`}/>)}</div></div>
   <div className={`canvas-wrap ${preset}`}><canvas ref={canvasRef} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}/></div>
   <div className="mobile-tool-dock"><button onClick={addText}><Type/>Text</button><button onClick={()=>addDeco('♡')}>♡<span>Decor</span></button><button onClick={exportPng}><Download/>Export</button></div>
  </section>

  <aside className="studio-panel right-panel">
   <section><h2><Layers size={16}/> Selected layer</h2>{selectedEl?<><label>Rotation<input type="range" min="-30" max="30" value={selectedEl.rotation} onChange={e=>updateSelected({rotation:Number(e.target.value)})}/></label>{selectedEl.kind==='card'&&<><div className="tool-row"><button onClick={()=>updateSelected({side:selectedEl.side==='front'?'back':'front'})}><RotateCw size={15}/>Flip</button></div><label>Size<input type="range" min="140" max="520" value={selectedEl.w} onChange={e=>{const w=Number(e.target.value);updateSelected({w,h:w*1.5})}}/></label></>}{selectedEl.kind!=='card'&&<><label>Text<input value={selectedEl.text} onChange={e=>updateSelected({text:e.target.value})}/></label><label>Size<input type="range" min="28" max="140" value={selectedEl.size} onChange={e=>updateSelected({size:Number(e.target.value)})}/></label></>}<div className="tool-row"><button onClick={()=>updateSelected({z:Math.max(0,...elements.map(e=>e.z))+1})}>Bring front</button><button className="danger" onClick={removeSelected}><Trash2 size={15}/>Delete</button></div></>:<p className="studio-muted">Tap an item on the canvas to edit it.</p>}</section>
   <section><h2><Sparkles size={16}/> Export</h2><p className="studio-muted">Exports at the full social size, not the smaller preview size. Your draft also saves automatically on this device.</p><button className="export-button" onClick={exportPng}><Download size={18}/>Save PNG</button><button className="reset-button" onClick={clearCanvas}><Undo2 size={16}/>Clear canvas</button></section>
   {notice&&<p className="studio-notice">{notice}</p>}
  </aside>
 </div>
}
