'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import {Check,Download,Share2,Sparkles,WandSparkles} from 'lucide-react';
import type {Card} from '@/lib/catalog';

type TemplateId='top6'|'series'|'recent'|'grid';
type FormatId='story'|'post'|'square';
type Step='style'|'cards'|'format'|'result';
type SavedState={cards?:Card[];wallet?:{owned?:string[]}};
type Placement={card:Card;x:number;y:number;w:number;h:number;rotation:number};

const DRAFT_KEY='tropeamine-showcase-draft-v1';
const templates:Record<TemplateId,{name:string;eyebrow:string;description:string;max:number;title:string;bg:[string,string];studioBg:'plum'|'midnight'|'rose'}>={
 top6:{name:'Top 6',eyebrow:'BEST FIRST PICK',description:'Big, clean card art with a polished collector layout.',max:6,title:'MY TOP PICKS',bg:['#230f21','#6e285d'],studioBg:'plum'},
 series:{name:'Series Spotlight',eyebrow:'ONE STORY WORLD',description:'Feature characters from one book or series together.',max:6,title:'SERIES SPOTLIGHT',bg:['#111827','#31233f'],studioBg:'midnight'},
 recent:{name:'Recent Pulls',eyebrow:'FRESH FROM THE PACK',description:'A more playful layout for the cards you want to show off now.',max:6,title:'FRESH PULLS',bg:['#3b1725','#a34f72'],studioBg:'rose'},
 grid:{name:'Collection Grid',eyebrow:'DREAMBORN-STYLE',description:'A tidy collection image that puts the cards first.',max:12,title:'MY COLLECTION',bg:['#0d121a','#283244'],studioBg:'midnight'}
};

const formats:Record<FormatId,{name:string;hint:string;w:number;h:number}>={
 story:{name:'Story',hint:'Instagram / TikTok',w:1080,h:1920},
 post:{name:'Post',hint:'Portrait social post',w:1080,h:1350},
 square:{name:'Square',hint:'Profile / feed',w:1080,h:1080}
};

function uid(){return crypto.randomUUID()}
function loadImage(src:string){return new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.crossOrigin='anonymous';img.decoding='async';img.onload=()=>resolve(img);img.onerror=reject;img.src=src})}
function roundedRect(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number){const rr=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+rr,y);ctx.arcTo(x+w,y,x+w,y+h,rr);ctx.arcTo(x+w,y+h,x,y+h,rr);ctx.arcTo(x,y+h,x,y,rr);ctx.arcTo(x,y,x+w,y,rr);ctx.closePath()}

export default function ShowcaseQuickCreate(){
 const canvasRef=useRef<HTMLCanvasElement>(null);
 const [step,setStep]=useState<Step>('style');
 const [template,setTemplate]=useState<TemplateId>('top6');
 const [format,setFormat]=useState<FormatId>('post');
 const [cards,setCards]=useState<Card[]>([]);
 const [owned,setOwned]=useState<string[]>([]);
 const [selected,setSelected]=useState<string[]>([]);
 const [seriesFilter,setSeriesFilter]=useState('All series');
 const [search,setSearch]=useState('');
 const [notice,setNotice]=useState('');
 const activeTemplate=templates[template];
 const dims=formats[format];

 useEffect(()=>{
  try{
   const raw=localStorage.getItem('tropeamine-packs-v1');
   if(!raw)return;
   const parsed=JSON.parse(raw) as SavedState;
   setCards(Array.isArray(parsed.cards)?parsed.cards:[]);
   setOwned(Array.isArray(parsed.wallet?.owned)?parsed.wallet!.owned!.filter(id=>!id.includes(':')):[]);
  }catch{}
 },[]);

 const ownedCards=useMemo(()=>cards.filter(c=>owned.includes(c.id)).filter(c=>!c.adult&&!c.tags?.includes('Mature Content')),[cards,owned]);
 const series=useMemo(()=>['All series',...Array.from(new Set(ownedCards.map(c=>c.series).filter(Boolean))).sort()],[ownedCards]);
 const filteredCards=useMemo(()=>ownedCards.filter(c=>seriesFilter==='All series'||c.series===seriesFilter).filter(c=>`${c.name} ${c.series}`.toLowerCase().includes(search.toLowerCase())),[ownedCards,seriesFilter,search]);
 const chosen=selected.map(id=>ownedCards.find(c=>c.id===id)).filter((c):c is Card=>Boolean(c));

 useEffect(()=>{if(step==='result')void renderCanvas()},[step,template,format,selected,cards]);

 function chooseTemplate(id:TemplateId){setTemplate(id);setSelected(v=>v.slice(0,templates[id].max));setStep('cards');setNotice('')}
 function toggleCard(id:string){setSelected(current=>{if(current.includes(id))return current.filter(x=>x!==id);if(current.length>=activeTemplate.max){setNotice(`${activeTemplate.name} holds up to ${activeTemplate.max} cards.`);return current}setNotice('');return [...current,id]})}
 function surpriseMe(){const pool=[...filteredCards].sort(()=>Math.random()-.5).slice(0,Math.min(activeTemplate.max,6,filteredCards.length));setSelected(pool.map(c=>c.id));setNotice(pool.length?'Picked a set for you ✨':'No collected cards found in this filter.')}
 function showcaseTitle(){if(template==='series'){const names=Array.from(new Set(chosen.map(c=>c.series).filter(Boolean)));if(names.length===1)return names[0].toUpperCase()}return activeTemplate.title}

 function placements(width:number,height:number){
  const list=chosen;
  const top=height*(format==='story' ? .16 : .18),bottom=height*.90;
  const areaH=bottom-top;
  const result:Placement[]=[];
  if(!list.length)return result;
  if(template==='recent'&&list.length<=6){
   const cols=Math.min(3,list.length),rows=Math.ceil(list.length/cols),cardW=Math.min(width*.255,areaH/(rows*1.65)),cardH=cardW*1.5;
   list.forEach((card,i)=>{const col=i%cols,row=Math.floor(i/cols);const x=(col+1)*width/(cols+1);const y=top+(row+.55)*(areaH/rows);result.push({card,x,y,w:cardW,h:cardH,rotation:(i%3-1)*4})});
   return result;
  }
  if(template==='grid'){
   const cols=list.length<=4?2:3,rows=Math.ceil(list.length/cols);const cardW=Math.min(width*.245,(areaH/rows)/1.58),cardH=cardW*1.5;
   list.forEach((card,i)=>{const col=i%cols,row=Math.floor(i/cols);const x=(col+1)*width/(cols+1);const y=top+(row+.55)*(areaH/rows);result.push({card,x,y,w:cardW,h:cardH,rotation:0})});
   return result;
  }
  if(list.length===1){const cardW=Math.min(width*.52,areaH*.52),cardH=cardW*1.5;return[{card:list[0],x:width/2,y:top+areaH*.48,w:cardW,h:cardH,rotation:0}]}
  if(list.length===2){const cardW=Math.min(width*.38,areaH*.42);list.forEach((card,i)=>result.push({card,x:width*(i ? .69 : .31),y:top+areaH*.48,w:cardW,h:cardW*1.5,rotation:i?3:-3}));return result}
  const cols=list.length<=4?2:3,rows=Math.ceil(list.length/cols);const cardW=Math.min(cols===2?width*.31:width*.245,(areaH/rows)/1.62),cardH=cardW*1.5;
  list.forEach((card,i)=>{const col=i%cols,row=Math.floor(i/cols);const x=(col+1)*width/(cols+1);const y=top+(row+.55)*(areaH/rows);result.push({card,x,y,w:cardW,h:cardH,rotation:template==='series'?(i%2?1.8:-1.8):0})});
  return result;
 }

 async function renderCanvas(){
  const canvas=canvasRef.current;if(!canvas)return;
  canvas.width=dims.w;canvas.height=dims.h;
  const ctx=canvas.getContext('2d');if(!ctx)return;
  const grad=ctx.createLinearGradient(0,0,dims.w,dims.h);grad.addColorStop(0,activeTemplate.bg[0]);grad.addColorStop(1,activeTemplate.bg[1]);ctx.fillStyle=grad;ctx.fillRect(0,0,dims.w,dims.h);
  ctx.fillStyle='rgba(255,255,255,.055)';for(let i=0;i<28;i++){ctx.beginPath();ctx.arc((i*173)%dims.w,(i*281)%dims.h,2+(i%4),0,Math.PI*2);ctx.fill()}
  const pad=60;
  ctx.fillStyle='#fff9f3';ctx.textBaseline='middle';ctx.textAlign='left';ctx.font=`700 ${format==='story'?58:50}px Georgia,serif`;ctx.fillText(showcaseTitle(),pad,format==='story'?105:92,dims.w*.58);
  ctx.textAlign='right';ctx.font=`700 ${format==='story'?30:28}px Georgia,serif`;ctx.fillStyle='rgba(255,255,255,.92)';ctx.fillText('TROPEAMINE PACKS',dims.w-pad,format==='story'?102:90);
  ctx.fillStyle='rgba(255,255,255,.55)';ctx.font='600 18px system-ui,sans-serif';ctx.fillText('COLLECT • CREATE • SHARE',dims.w-pad,format==='story'?139:127);
  for(const item of placements(dims.w,dims.h)){
   ctx.save();ctx.translate(item.x,item.y);ctx.rotate(item.rotation*Math.PI/180);ctx.shadowColor='rgba(0,0,0,.48)';ctx.shadowBlur=24;ctx.shadowOffsetY=13;
   const x=-item.w/2,y=-item.h/2;roundedRect(ctx,x,y,item.w,item.h,16);ctx.fillStyle='rgba(255,255,255,.11)';ctx.fill();ctx.clip();
   if(item.card.image){try{const img=await loadImage(item.card.image);ctx.drawImage(img,x,y,item.w,item.h)}catch{ctx.fillStyle='rgba(255,255,255,.08)';ctx.fillRect(x,y,item.w,item.h)}}
   ctx.restore();
  }
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='rgba(255,255,255,.58)';ctx.font='600 18px system-ui,sans-serif';ctx.fillText(`${chosen.length} card${chosen.length===1?'':'s'} from my collection`,dims.w/2,dims.h-48);
 }

 function canvasBlob(){return new Promise<Blob|null>(resolve=>{const canvas=canvasRef.current;if(!canvas){resolve(null);return}canvas.toBlob(resolve,'image/png')})}
 async function savePng(){const blob=await canvasBlob();if(!blob)return;const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`tropeamine-showcase-${Date.now()}.png`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice('Showcase saved as a full-quality PNG.')}
 async function shareShowcase(){const blob=await canvasBlob();if(!blob)return;const file=new File([blob],'tropeamine-showcase.png',{type:'image/png'});try{if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){await navigator.share({title:'My Tropeamine Packs Showcase',files:[file]});setNotice('Shared ✨');return}}catch(err){if((err as DOMException)?.name==='AbortError')return}await savePng();setNotice('Native sharing is not available here, so the PNG was saved instead.')}

 function editInStudio(){
  const source=placements(dims.w,dims.h);
  const studioPreset=format==='square'?'square':'story';const studioW=1080,studioH=studioPreset==='square'?1080:1920;const sx=studioW/dims.w,sy=studioH/dims.h;
  const elements=[...source.map((p,i)=>({id:uid(),kind:'card' as const,cardId:p.card.id,side:'front' as const,x:p.x*sx,y:p.y*sy,w:p.w*sx,h:p.h*sx,rotation:p.rotation,z:i+1,locked:false})),
   {id:uid(),kind:'text' as const,text:showcaseTitle(),x:250,y:(format==='story'?105:92)*sy,size:54,rotation:0,z:50,locked:false},
   {id:uid(),kind:'text' as const,text:'TROPEAMINE PACKS',x:880,y:(format==='story'?102:90)*sy,size:28,rotation:0,z:51,locked:true}];
  try{localStorage.setItem(DRAFT_KEY,JSON.stringify({preset:studioPreset,bg:activeTemplate.studioBg,elements,snap:true}))}catch{}
  window.location.href='/showcase/create';
 }

 if(step==='style')return <section className="quick-create-flow">
  <div className="quick-step-head"><span>STEP 1 OF 3</span><h1>Pick a style</h1><p>Choose the vibe. We’ll handle the layout.</p></div>
  <div className="quick-template-grid">{(Object.keys(templates) as TemplateId[]).map(id=>{const item=templates[id];return <button key={id} className={`quick-template-card ${id==='top6'?'featured':''}`} onClick={()=>chooseTemplate(id)}><span>{item.eyebrow}</span><div className={`quick-template-preview preview-${id}`}><i/><i/><i/><i/><i/><i/></div><strong>{item.name}</strong><small>{item.description}</small></button>})}</div>
  <a className="quick-secondary-link" href="/showcase/create">Prefer full control? Open Studio →</a>
 </section>;

 if(step==='cards')return <section className="quick-create-flow">
  <div className="quick-step-head"><button className="quick-back" onClick={()=>setStep('style')}>← Styles</button><span>STEP 2 OF 3</span><h1>Pick your cards</h1><p>Tap in the order you want them featured. {selected.length}/{activeTemplate.max} selected.</p></div>
  <div className="quick-card-tools"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search your collection…"/><select value={seriesFilter} onChange={e=>setSeriesFilter(e.target.value)}>{series.map(s=><option key={s}>{s}</option>)}</select><button onClick={surpriseMe}><Sparkles size={16}/> Surprise me</button></div>
  {ownedCards.length?<div className="quick-card-grid">{filteredCards.map(card=>{const order=selected.indexOf(card.id);return <button key={card.id} className={order>=0?'selected':''} onClick={()=>toggleCard(card.id)}><span className="quick-card-art">{card.image?<img src={card.image} alt=""/>:<i/>}{order>=0&&<b>{order+1}</b>}</span><small>{card.name}</small><em>{card.series}</em></button>})}</div>:<div className="quick-empty"><WandSparkles/><strong>Your binder is waiting.</strong><p>Collect a card first, then come back to turn it into something shareable.</p><a href="/packs">Open packs</a></div>}
  {notice&&<p className="quick-notice">{notice}</p>}
  <div className="quick-sticky-actions"><button disabled={!selected.length} onClick={()=>setStep('format')}>Continue with {selected.length||'your'} card{selected.length===1?'':'s'} →</button></div>
 </section>;

 if(step==='format')return <section className="quick-create-flow narrow">
  <div className="quick-step-head"><button className="quick-back" onClick={()=>setStep('cards')}>← Cards</button><span>STEP 3 OF 3</span><h1>Where are you sharing?</h1><p>We’ll export at full resolution either way.</p></div>
  <div className="quick-format-grid">{(Object.keys(formats) as FormatId[]).map(id=>{const f=formats[id];return <button key={id} className={format===id?'selected':''} onClick={()=>setFormat(id)}><div className={`format-shape ${id}`}/><strong>{f.name}</strong><small>{f.hint}</small>{format===id&&<Check size={18}/>}</button>})}</div>
  <div className="quick-sticky-actions"><button onClick={()=>setStep('result')}><Sparkles size={18}/> Create my Showcase</button></div>
 </section>;

 return <section className="quick-create-flow result">
  <div className="quick-step-head"><span>DONE ✨</span><h1>Your Showcase is ready</h1><p>Full-quality card art, automatic layout, and Tropeamine branding included.</p></div>
  <div className={`quick-result-frame ${format}`}><canvas ref={canvasRef}/></div>
  <div className="quick-result-actions"><button className="primary" onClick={shareShowcase}><Share2 size={18}/> Share Showcase</button><button onClick={savePng}><Download size={18}/> Save PNG</button><button onClick={editInStudio}><WandSparkles size={18}/> Edit in Studio</button><button onClick={()=>setStep('style')}>Try another style</button></div>
  {notice&&<p className="quick-notice">{notice}</p>}
 </section>;
}
