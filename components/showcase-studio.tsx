'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import {Copy,Download,Image as ImageIcon,Layers,Lock,Plus,RotateCcw,RotateCw,Sparkles,Trash2,Type,Undo2,Unlock} from 'lucide-react';
import type {Card} from '@/lib/catalog';

type CanvasPreset='story'|'square'|'landscape';
type BgPreset='plum'|'midnight'|'paper'|'rose';
type BaseElement={id:string;x:number;y:number;rotation:number;z:number;locked?:boolean};
type CardElement=BaseElement&{kind:'card';cardId:string;side:'front'|'back';w:number;h:number};
type TextElement=BaseElement&{kind:'text';text:string;size:number};
type DecoElement=BaseElement&{kind:'deco';text:string;size:number};
type Element=CardElement|TextElement|DecoElement;
type SavedState={cards?:Card[];wallet?:{owned?:string[]};adultOptIn?:boolean};
type Draft={preset:CanvasPreset;bg:BgPreset;elements:Element[];snap?:boolean};
type Guides={x?:number;y?:number};

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
 const [snap,setSnap]=useState(true);
 const [guides,setGuides]=useState<Guides>({});
 const dims=sizes[preset];
 const visibleCards=useMemo(()=>cards.filter(c=>owned.includes(c.id)).filter(c=>showMature||(!c.adult&&!c.tags?.includes('Mature Content'))),[cards,owned,showMature]);
 const selectedEl=elements.find(e=>e.id===selected)||null;
 const canvasCards=elements.filter((e):e is CardElement=>e.kind==='card');

 useEffect(()=>{
  try{
   const raw=localStorage.getItem('tropeamine-packs-v1');
   if(raw){const parsed=JSON.parse(raw) as SavedState;setCards(Array.isArray(parsed.cards)?parsed.cards:[]);setOwned(Array.isArray(parsed.wallet?.owned)?parsed.wallet!.owned!.filter(id=>!id.includes(':')):[]);setAdultOptIn(Boolean(parsed.adultOptIn))}
   const draftRaw=localStorage.getItem(DRAFT_KEY);
   if(draftRaw){const draft=JSON.parse(draftRaw) as Draft;if(draft?.preset&&draft?.bg&&Array.isArray(draft.elements)){setPreset(draft.preset);setBg(draft.bg);setElements(draft.elements);setSnap(draft.snap!==false);setNotice('Your last showcase draft was restored.')}}
  }catch{}
 },[]);

 useEffect(()=>{try{localStorage.setItem(DRAFT_KEY,JSON.stringify({preset,bg,elements,snap} satisfies Draft))}catch{}},[preset,bg,elements,snap]);
 useEffect(()=>{draw()},[elements,bg,preset,cards,selected,guides]);

 function cachedImage(src:string){const existing=imageCache.current[src];if(existing)return existing;const img=new Image();img.crossOrigin='anonymous';img.decoding='async';img.onload=()=>draw();img.src=src;imageCache.current[src]=img;return img}
 function bounds(el:Element){if(el.kind==='card')return{w:el.w,h:el.h};const w=Math.max(180,el.text.length*el.size*.55);return{w,h:el.size*1.35}}

 function draw(){
  const canvas=canvasRef.current;if(!canvas)return;canvas.width=dims.w;canvas.height=dims.h;
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
  if(guides.x!==undefined){ctx.strokeStyle='rgba(255,190,230,.9)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(guides.x,0);ctx.lineTo(guides.x,dims.h);ctx.stroke()}
  if(guides.y!==undefined){ctx.strokeStyle='rgba(255,190,230,.9)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,guides.y);ctx.lineTo(dims.w,guides.y);ctx.stroke()}
  const active=elements.find(e=>e.id===selected);
  if(active){const {w,h}=bounds(active);ctx.save();ctx.translate(active.x,active.y);ctx.rotate(active.rotation*Math.PI/180);ctx.strokeStyle=active.locked?'rgba(255,205,120,.95)':'rgba(255,255,255,.95)';ctx.lineWidth=Math.max(2,dims.w/500);ctx.setLineDash(active.locked?[5,6]:[12,8]);ctx.strokeRect(-w/2,-h/2,w,h);ctx.restore()}
 }

 function addCard(card:Card){const z=Math.max(0,...elements.map(e=>e.z))+1,id=uid();setElements(v=>[...v,{id,kind:'card',cardId:card.id,side:'front',x:dims.w/2,y:dims.h/2,w:280,h:420,rotation:0,z,locked:false}]);setSelected(id)}
 function addText(){const z=Math.max(0,...elements.map(e=>e.z))+1,id=uid();setElements(v=>[...v,{id,kind:'text',text:'My current obsessions',x:dims.w/2,y:140,size:64,rotation:0,z,locked:false}]);setSelected(id)}
 function addDeco(text:string){const z=Math.max(0,...elements.map(e=>e.z))+1,id=uid();setElements(v=>[...v,{id,kind:'deco',text,x:dims.w/2,y:dims.h/2,size:72,rotation:0,z,locked:false}]);setSelected(id)}
 function removeSelected(){if(!selected)return;setElements(v=>v.filter(e=>e.id!==selected));setSelected(null)}
 function updateSelected(patch:Record<string,unknown>){if(!selected)return;setElements(v=>v.map(e=>e.id===selected?({...e,...patch} as Element):e))}
 function duplicateSelected(){if(!selectedEl)return;const id=uid(),z=Math.max(0,...elements.map(e=>e.z))+1;setElements(v=>[...v,{...selectedEl,id,x:clamp(selectedEl.x+28,0,dims.w),y:clamp(selectedEl.y+28,0,dims.h),z,locked:false} as Element]);setSelected(id)}
 function sendBackward(){if(!selectedEl)return;const sorted=[...elements].sort((a,b)=>a.z-b.z),i=sorted.findIndex(e=>e.id===selectedEl.id);if(i<=0)return;const other=sorted[i-1];setElements(v=>v.map(e=>e.id===selectedEl.id?{...e,z:other.z}:e.id===other.id?{...e,z:selectedEl.z}:e))}
 function toCanvasPoint(e:React.PointerEvent<HTMLCanvasElement>){const rect=e.currentTarget.getBoundingClientRect();return{x:(e.clientX-rect.left)*(dims.w/rect.width),y:(e.clientY-rect.top)*(dims.h/rect.height)}}
 function hitTest(x:number,y:number){return [...elements].sort((a,b)=>b.z-a.z).find(el=>{const {w,h}=bounds(el);return Math.abs(x-el.x)<=w/2&&Math.abs(y-el.y)<=h/2})||null}
 function pointerDown(e:React.PointerEvent<HTMLCanvasElement>){const p=toCanvasPoint(e),hit=hitTest(p.x,p.y);setSelected(hit?.id||null);if(hit&&!hit.locked){e.currentTarget.setPointerCapture(e.pointerId);setDrag({id:hit.id,dx:p.x-hit.x,dy:p.y-hit.y})}}
 function snapPoint(el:Element,x:number,y:number){if(!snap)return{x,y,g:{}};const threshold=20;let sx=x,sy=y,g:Guides={};const candidatesX=[dims.w/2,dims.w*.05,dims.w*.95],candidatesY=[dims.h/2,dims.h*.05,dims.h*.95];elements.filter(other=>other.id!==el.id).forEach(other=>{const ob=bounds(other);candidatesX.push(other.x,other.x-ob.w/2,other.x+ob.w/2);candidatesY.push(other.y,other.y-ob.h/2,other.y+ob.h/2)});let bestX=threshold+1,bestY=threshold+1;for(const cx of candidatesX){const d=Math.abs(x-cx);if(d<bestX){bestX=d;sx=cx;g.x=cx}}for(const cy of candidatesY){const d=Math.abs(y-cy);if(d<bestY){bestY=d;sy=cy;g.y=cy}}if(bestX>threshold){sx=x;delete g.x}if(bestY>threshold){sy=y;delete g.y}return{x:sx,y:sy,g}}
 function pointerMove(e:React.PointerEvent<HTMLCanvasElement>){if(!drag)return;const p=toCanvasPoint(e);setElements(v=>v.map(el=>{if(el.id!==drag.id)return el;const next=snapPoint(el,clamp(p.x-drag.dx,0,dims.w),clamp(p.y-drag.dy,0,dims.h));setGuides(next.g);return{...el,x:next.x,y:next.y}}))}
 function pointerUp(){setDrag(null);setGuides({})}

 function applyTemplate(kind:'top6'|'hero'|'grid9'){
  const currentCards=[...canvasCards].sort((a,b)=>a.z-b.z);if(!currentCards.length){setNotice('Add the cards you want first, then choose a template to arrange them.');return}
  const updates=new Map<string,Partial<CardElement>>();
  if(kind==='hero'){
   currentCards.forEach((el,i)=>{if(i===0)updates.set(el.id,{x:dims.w/2,y:dims.h*.43,w:430,h:645,rotation:0});else{const j=i-1,cols=Math.min(2,Math.max(1,currentCards.length-1)),rows=Math.ceil((currentCards.length-1)/cols),w=Math.min(220,dims.w/(cols+2));updates.set(el.id,{x:(j%cols+1)*dims.w/(cols+1),y:dims.h*.17+Math.floor(j/cols)*(dims.h*.66/Math.max(1,rows-1||1)),w,h:w*1.5,rotation:j%2?-4:4})}});
  }else{
   const cols=kind==='grid9'?Math.min(3,currentCards.length):Math.min(2,currentCards.length),rows=Math.ceil(currentCards.length/cols),w=Math.min(kind==='grid9'?230:280,(dims.w*.72)/cols),h=w*1.5;
   currentCards.forEach((el,i)=>{const col=i%cols,row=Math.floor(i/cols);updates.set(el.id,{x:(col+1)*dims.w/(cols+1),y:(row+1)*dims.h/(rows+1),w,h,rotation:0})});
  }
  setElements(v=>v.map(el=>el.kind==='card'&&updates.has(el.id)?{...el,...updates.get(el.id)!}:el));setSelected(null);setNotice(`Template arranged ${currentCards.length} card${currentCards.length===1?'':'s'} already on your canvas.`);
 }

 function exportPng(){const canvas=canvasRef.current;if(!canvas)return;setSelected(null);requestAnimationFrame(()=>requestAnimationFrame(()=>{try{const link=document.createElement('a');link.download=`tropeamine-showcase-${Date.now()}.png`;link.href=canvas.toDataURL('image/png');link.click();setNotice('PNG exported.')}catch{setNotice('One of the selected images could not be exported. Try another card or reload the studio.')}}))}
 function clearCanvas(){setElements([]);setSelected(null);try{localStorage.removeItem(DRAFT_KEY)}catch{}setNotice('Canvas cleared.')}

 return <div className="studio-grid">
  <aside className="studio-panel left-panel">
   <section><h2>Arrange your cards</h2><p className="studio-muted">Add the cards you want first. Templates rearrange only the cards already on your canvas.</p><div className="template-grid"><button onClick={()=>applyTemplate('top6')}>2-column</button><button onClick={()=>applyTemplate('hero')}>Hero</button><button onClick={()=>applyTemplate('grid9')}>Grid</button></div></section>
   <section><h2><ImageIcon size={16}/> Your cards</h2><div className="card-picker">{visibleCards.length?visibleCards.map(c=><button key={c.id} onClick={()=>addCard(c)} title={`Add ${c.name}`}><span>{c.image?<img src={c.image} alt=""/>:<Plus/>}</span><small>{c.name}</small></button>):<p className="studio-muted">No collected cards found on this device yet.</p>}</div>{adultOptIn&&<label className="studio-check"><input type="checkbox" checked={showMature} onChange={e=>setShowMature(e.target.checked)}/>Include Mature Content cards</label>}</section>
   <section><h2><Plus size={16}/> Add</h2><div className="tool-row"><button onClick={addText}><Type size={16}/>Text</button><button onClick={()=>addDeco('♡')}>♡</button><button onClick={()=>addDeco('✦')}>✦</button><button onClick={()=>addDeco('☾')}>☾</button></div></section>
  </aside>

  <section className="studio-center">
   <div className="studio-toolbar"><div>{(Object.keys(sizes) as CanvasPreset[]).map(k=><button key={k} className={preset===k?'active':''} onClick={()=>setPreset(k)}>{sizes[k].label}</button>)}</div><div className="studio-toolbar-options"><button className={snap?'active':''} onClick={()=>setSnap(v=>!v)}>Snap {snap?'On':'Off'}</button>{(Object.keys(bgs) as BgPreset[]).map(k=><button key={k} className={`swatch swatch-${k} ${bg===k?'active':''}`} onClick={()=>setBg(k)} aria-label={`${bgs[k].label} background`}/>)}</div></div>
   <div className={`canvas-wrap ${preset}`}><canvas ref={canvasRef} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}/></div>
   <div className="mobile-tool-dock"><button onClick={addText}><Type/>Text</button><button className={snap?'active':''} onClick={()=>setSnap(v=>!v)}>✦<span>Snap</span></button><button onClick={exportPng}><Download/>Export</button></div>
  </section>

  <aside className="studio-panel right-panel">
   <section><h2><Layers size={16}/> Selected layer</h2>{selectedEl?<><div className="selected-state"><span>{selectedEl.kind==='card'?(cards.find(c=>c.id===selectedEl.cardId)?.name||'Card'):selectedEl.kind==='text'?'Text':'Decoration'}</span>{selectedEl.locked&&<b><Lock size={12}/> Locked</b>}</div><label>Rotation<input type="range" min="-30" max="30" disabled={selectedEl.locked} value={selectedEl.rotation} onChange={e=>updateSelected({rotation:Number(e.target.value)})}/></label>{selectedEl.kind==='card'&&<><div className="tool-row"><button disabled={selectedEl.locked} onClick={()=>updateSelected({side:selectedEl.side==='front'?'back':'front'})}><RotateCw size={15}/>Flip</button></div><label>Size<input type="range" min="140" max="520" disabled={selectedEl.locked} value={selectedEl.w} onChange={e=>{const w=Number(e.target.value);updateSelected({w,h:w*1.5})}}/></label></>}{selectedEl.kind!=='card'&&<><label>Text<input disabled={selectedEl.locked} value={selectedEl.text} onChange={e=>updateSelected({text:e.target.value})}/></label><label>Size<input type="range" min="28" max="140" disabled={selectedEl.locked} value={selectedEl.size} onChange={e=>updateSelected({size:Number(e.target.value)})}/></label></>}<div className="tool-row"><button onClick={()=>updateSelected({locked:!selectedEl.locked})}>{selectedEl.locked?<><Unlock size={15}/>Unlock</>:<><Lock size={15}/>Lock</>}</button><button onClick={duplicateSelected}><Copy size={15}/>Duplicate</button><button disabled={selectedEl.locked} onClick={()=>updateSelected({rotation:0})}><RotateCcw size={15}/>Reset</button><button disabled={selectedEl.locked} onClick={()=>updateSelected({z:Math.max(0,...elements.map(e=>e.z))+1})}>Bring front</button><button disabled={selectedEl.locked} onClick={sendBackward}>Send back</button><button className="danger" onClick={removeSelected}><Trash2 size={15}/>Delete</button></div></>:<p className="studio-muted">Tap an item on the canvas to edit it.</p>}</section>
   <section><h2><Sparkles size={16}/> Export</h2><p className="studio-muted">Exports at the full social size, not the smaller preview size. Your draft saves automatically on this device.</p><button className="export-button" onClick={exportPng}><Download size={18}/>Save PNG</button><button className="reset-button" onClick={clearCanvas}><Undo2 size={16}/>Clear canvas</button></section>
   {notice&&<p className="studio-notice">{notice}</p>}
  </aside>
 </div>
}
