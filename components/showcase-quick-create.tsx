'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import {Check,Download,Share2,Sparkles,WandSparkles} from 'lucide-react';
import type {Card} from '@/lib/catalog';

type TemplateId='top6'|'series'|'recent'|'grid';
type FormatId='story'|'post'|'square';
type BackgroundId='auto'|'plum'|'midnight'|'rose'|'parchment'|'emerald'|'sapphire'|'crimson';
type Step='style'|'cards'|'format'|'result';
type SavedState={cards?:Card[];wallet?:{owned?:string[]}};
type Placement={card:Card;x:number;y:number;w:number;h:number;rotation:number};
type BackgroundDefinition={name:string;hint:string;colors:[string,string,string];accent:string;text:string;muted:string;studioBg:'plum'|'midnight'|'paper'|'rose'};

const DRAFT_KEY='tropeamine-showcase-draft-v1';
const templates:Record<TemplateId,{name:string;eyebrow:string;description:string;max:number;title:string;defaultBackground:Exclude<BackgroundId,'auto'>}>={
 top6:{name:'Top 6',eyebrow:'BEST FIRST PICK',description:'Big, dramatic card art with an editorial collector layout.',max:6,title:'Current Obsessions',defaultBackground:'plum'},
 series:{name:'Series Spotlight',eyebrow:'ONE STORY WORLD',description:'Give one book or series a polished poster-style moment.',max:6,title:'Series Spotlight',defaultBackground:'midnight'},
 recent:{name:'Recent Pulls',eyebrow:'FRESH FROM THE PACK',description:'A playful social-first layout for cards you just pulled.',max:6,title:'Fresh From the Pack',defaultBackground:'rose'},
 grid:{name:'Collection Grid',eyebrow:'CLEAN COLLECTOR GRID',description:'A tidy collection image that lets the cards do the talking.',max:12,title:'From My Binder',defaultBackground:'midnight'}
};

const formats:Record<FormatId,{name:string;hint:string;w:number;h:number}>={
 story:{name:'Story',hint:'Instagram / TikTok',w:1080,h:1920},
 post:{name:'Post',hint:'Instagram portrait',w:1080,h:1350},
 square:{name:'Square',hint:'Feed / profile',w:1080,h:1080}
};

const backgrounds:Record<Exclude<BackgroundId,'auto'>,BackgroundDefinition>={
 plum:{name:'Plum Velvet',hint:'Signature Tropeamine',colors:['#160a15','#4a183f','#8a3b70'],accent:'#e6a8d1',text:'#fff8f3',muted:'rgba(255,248,243,.62)',studioBg:'plum'},
 midnight:{name:'Midnight Ink',hint:'Dark & editorial',colors:['#06080d','#141b2a','#313a54'],accent:'#aeb9dc',text:'#fffaf5',muted:'rgba(255,250,245,.6)',studioBg:'midnight'},
 rose:{name:'Rose Noir',hint:'Romantic & moody',colors:['#160a10','#572035','#a44f6d'],accent:'#f0b4cb',text:'#fff8f4',muted:'rgba(255,248,244,.62)',studioBg:'rose'},
 parchment:{name:'Warm Parchment',hint:'Bookish & editorial',colors:['#b99678','#ead9c3','#c9a084'],accent:'#6f3549',text:'#2a1b1e',muted:'rgba(42,27,30,.62)',studioBg:'paper'},
 emerald:{name:'Emerald Night',hint:'Rich & dramatic',colors:['#03100d','#0d3a2d','#236950'],accent:'#8de1b9',text:'#f5fff9',muted:'rgba(245,255,249,.62)',studioBg:'midnight'},
 sapphire:{name:'Sapphire After Dark',hint:'Cool & cinematic',colors:['#040d18','#10365a','#2b6f9f'],accent:'#93d5ff',text:'#f5fbff',muted:'rgba(245,251,255,.62)',studioBg:'midnight'},
 crimson:{name:'Crimson Velvet',hint:'Bold & dangerous',colors:['#160608','#541017','#a42a31'],accent:'#ffb0aa',text:'#fff8f5',muted:'rgba(255,248,245,.62)',studioBg:'rose'}
};

function uid(){return crypto.randomUUID()}
function loadImage(src:string){return new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.crossOrigin='anonymous';img.decoding='async';img.onload=()=>resolve(img);img.onerror=reject;img.src=src})}
function roundedRect(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number){const rr=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+rr,y);ctx.arcTo(x+w,y,x+w,y+h,rr);ctx.arcTo(x+w,y+h,x,y+h,rr);ctx.arcTo(x,y+h,x,y,rr);ctx.arcTo(x,y,x+w,y,rr);ctx.closePath()}
function hexToRgba(hex:string,alpha:number){const value=hex.replace('#','');const n=parseInt(value.length===3?value.split('').map(c=>c+c).join(''):value,16);return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${alpha})`}
function autoBackgroundId(chosen:Card[],template:TemplateId):Exclude<BackgroundId,'auto'>{
 const text=chosen.map(card=>`${card.series} ${card.genre} ${card.hue} ${card.tags?.join(' ')||''}`).join(' ').toLowerCase();
 if(text.includes('lights out'))return 'sapphire';
 if(text.includes('caught up'))return 'crimson';
 if(text.includes('game on'))return 'emerald';
 if(/sinners retreat|slay ride|ship happens|slaughter park|sinners reunion|slaycation/.test(text))return 'rose';
 if(/butcher & blackbird|leather & lark|scythe & sparrow|ruinous/.test(text))return 'midnight';
 if(/warlock|coven king/.test(text))return 'plum';
 return templates[template].defaultBackground;
}

export default function ShowcaseQuickCreate(){
 const canvasRef=useRef<HTMLCanvasElement>(null);
 const [step,setStep]=useState<Step>('style');
 const [template,setTemplate]=useState<TemplateId>('top6');
 const [format,setFormat]=useState<FormatId>('post');
 const [background,setBackground]=useState<BackgroundId>('auto');
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
 const resolvedBackgroundId=background==='auto'?autoBackgroundId(chosen,template):background;
 const activeBackground=backgrounds[resolvedBackgroundId];

 useEffect(()=>{if(step==='result')void renderCanvas()},[step,template,format,background,selected,cards]);

 function chooseTemplate(id:TemplateId){setTemplate(id);setSelected(v=>v.slice(0,templates[id].max));setStep('cards');setNotice('')}
 function toggleCard(id:string){setSelected(current=>{if(current.includes(id))return current.filter(x=>x!==id);if(current.length>=activeTemplate.max){setNotice(`${activeTemplate.name} holds up to ${activeTemplate.max} cards.`);return current}setNotice('');return [...current,id]})}
 function surpriseMe(){const pool=[...filteredCards].sort(()=>Math.random()-.5).slice(0,Math.min(activeTemplate.max,6,filteredCards.length));setSelected(pool.map(c=>c.id));setNotice(pool.length?'Picked a set for you ✨':'No collected cards found in this filter.')}
 function showcaseTitle(){if(template==='series'){const names=Array.from(new Set(chosen.map(c=>c.series).filter(Boolean)));if(names.length===1)return names[0]}return activeTemplate.title}

 function placements(width:number,height:number){
  const list=chosen;
  const header= format==='story'?220:format==='post'?168:150;
  const footer=format==='story'?78:58;
  const top=header,bottom=height-footer,areaH=bottom-top;
  const result:Placement[]=[];
  if(!list.length)return result;

  let cols:number;
  if(template==='grid')cols=format==='story'?3:list.length>8?4:3;
  else if(format==='story'&&list.length>=5)cols=2;
  else if(list.length<=2)cols=list.length;
  else if(list.length<=4)cols=2;
  else cols=3;

  const rows=Math.ceil(list.length/cols);
  const widthRatio=template==='grid'?(cols===4?.205:.255):(cols===3?.29:cols===2?.36:.52);
  const density=template==='grid'?1.56:1.53;
  const cardW=Math.min(width*widthRatio,areaH/(rows*density));
  const cardH=cardW*1.5;

  list.forEach((card,i)=>{
   const row=Math.floor(i/cols);
   const firstInRow=row*cols;
   const countInRow=Math.min(cols,list.length-firstInRow);
   const col=i-firstInRow;
   const x=(col+1)*width/(countInRow+1);
   const y=top+(row+.5)*(areaH/rows);
   let rotation=0;
   if(template==='recent')rotation=(i%3-1)*3.5;
   if(template==='series'&&list.length<5)rotation=i%2?1.4:-1.4;
   result.push({card,x,y,w:cardW,h:cardH,rotation});
  });
  return result;
 }

 function paintBackground(ctx:CanvasRenderingContext2D){
  const [a,b,c]=activeBackground.colors;
  const base=ctx.createLinearGradient(0,0,dims.w,dims.h);base.addColorStop(0,a);base.addColorStop(.54,b);base.addColorStop(1,c);ctx.fillStyle=base;ctx.fillRect(0,0,dims.w,dims.h);
  const glow=ctx.createRadialGradient(dims.w*.5,dims.h*.16,0,dims.w*.5,dims.h*.16,dims.w*.8);glow.addColorStop(0,hexToRgba(activeBackground.accent,.18));glow.addColorStop(.45,hexToRgba(activeBackground.accent,.055));glow.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,dims.w,dims.h);
  const vignette=ctx.createRadialGradient(dims.w*.5,dims.h*.48,dims.w*.2,dims.w*.5,dims.h*.48,dims.h*.72);vignette.addColorStop(.45,'rgba(0,0,0,0)');vignette.addColorStop(1,resolvedBackgroundId==='parchment'?'rgba(76,42,36,.16)':'rgba(0,0,0,.34)');ctx.fillStyle=vignette;ctx.fillRect(0,0,dims.w,dims.h);
  ctx.fillStyle=resolvedBackgroundId==='parchment'?'rgba(74,40,45,.065)':'rgba(255,255,255,.045)';for(let i=0;i<30;i++){ctx.beginPath();ctx.arc((i*173+37)%dims.w,(i*281+61)%dims.h,1.5+(i%4),0,Math.PI*2);ctx.fill()}
 }

 function drawHeader(ctx:CanvasRenderingContext2D){
  const pad=58,titleY=format==='story'?112:86,brandY=format==='story'?104:82;
  const title=showcaseTitle();
  let titleSize=format==='story'?64:58;
  ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillStyle=activeBackground.text;
  do{ctx.font=`italic 600 ${titleSize}px Georgia,serif`;if(ctx.measureText(title).width<=dims.w*.57||titleSize<=38)break;titleSize-=2}while(titleSize>38);
  ctx.fillText(title,pad,titleY);
  ctx.textAlign='right';ctx.font=`700 ${format==='story'?27:24}px Georgia,serif`;ctx.fillStyle=activeBackground.text;ctx.fillText('TROPEAMINE PACKS',dims.w-pad,brandY);
  ctx.fillStyle=activeBackground.muted;ctx.font='700 11px system-ui,sans-serif';ctx.fillText('A SHELF BEYOND THE STORY',dims.w-pad,brandY+30);
  ctx.strokeStyle=hexToRgba(activeBackground.accent,.32);ctx.lineWidth=1.25;ctx.beginPath();ctx.moveTo(pad,format==='story'?170:130);ctx.lineTo(dims.w-pad,format==='story'?170:130);ctx.stroke();
 }

 async function renderCanvas(){
  const canvas=canvasRef.current;if(!canvas)return;
  canvas.width=dims.w;canvas.height=dims.h;
  const ctx=canvas.getContext('2d');if(!ctx)return;
  paintBackground(ctx);drawHeader(ctx);
  for(const item of placements(dims.w,dims.h)){
   ctx.save();ctx.translate(item.x,item.y);ctx.rotate(item.rotation*Math.PI/180);ctx.shadowColor='rgba(0,0,0,.52)';ctx.shadowBlur=28;ctx.shadowOffsetY=14;
   const x=-item.w/2,y=-item.h/2;roundedRect(ctx,x,y,item.w,item.h,13);ctx.fillStyle='rgba(255,255,255,.1)';ctx.fill();ctx.clip();
   if(item.card.image){try{const img=await loadImage(item.card.image);ctx.drawImage(img,x,y,item.w,item.h)}catch{ctx.fillStyle='rgba(255,255,255,.08)';ctx.fillRect(x,y,item.w,item.h)}}
   ctx.restore();
  }
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=activeBackground.muted;ctx.font='600 13px system-ui,sans-serif';ctx.fillText('made with Tropeamine Packs',dims.w/2,dims.h-(format==='story'?29:25));
 }

 function canvasBlob(){return new Promise<Blob|null>(resolve=>{const canvas=canvasRef.current;if(!canvas){resolve(null);return}canvas.toBlob(resolve,'image/png')})}
 async function savePng(){const blob=await canvasBlob();if(!blob)return;const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`tropeamine-showcase-${Date.now()}.png`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice('Showcase saved as a full-quality PNG.')}
 async function shareShowcase(){const blob=await canvasBlob();if(!blob)return;const file=new File([blob],'tropeamine-showcase.png',{type:'image/png'});try{if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){await navigator.share({title:'My Tropeamine Packs Showcase',files:[file]});setNotice('Shared ✨');return}}catch(err){if((err as DOMException)?.name==='AbortError')return}await savePng();setNotice('Native sharing is not available here, so the PNG was saved instead.')}

 function editInStudio(){
  const source=placements(dims.w,dims.h);
  const studioPreset=format==='square'?'square':'story';const studioW=1080,studioH=studioPreset==='square'?1080:1920;const sx=studioW/dims.w,sy=studioH/dims.h;
  const elements=[...source.map((p,i)=>({id:uid(),kind:'card' as const,cardId:p.card.id,side:'front' as const,x:p.x*sx,y:p.y*sy,w:p.w*sx,h:p.h*sx,rotation:p.rotation,z:i+1,locked:false})),
   {id:uid(),kind:'text' as const,text:showcaseTitle(),x:250,y:(format==='story'?112:86)*sy,size:54,rotation:0,z:50,locked:false},
   {id:uid(),kind:'text' as const,text:'TROPEAMINE PACKS',x:880,y:(format==='story'?104:82)*sy,size:27,rotation:0,z:51,locked:true}];
  try{localStorage.setItem(DRAFT_KEY,JSON.stringify({preset:studioPreset,bg:activeBackground.studioBg,elements,snap:true}))}catch{}
  window.location.href='/showcase/create';
 }

 if(step==='style')return <section className="quick-create-flow">
  <div className="quick-step-head"><span>STEP 1 OF 3</span><h1>Pick a style</h1><p>Choose the vibe. We’ll handle the art direction.</p></div>
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
  <div className="quick-step-head"><button className="quick-back" onClick={()=>setStep('cards')}>← Cards</button><span>STEP 3 OF 3</span><h1>Set the mood</h1><p>Choose a social size and a backdrop. Auto matches the mood to your cards.</p></div>
  <h2 className="quick-option-heading">Where are you sharing?</h2>
  <div className="quick-format-grid">{(Object.keys(formats) as FormatId[]).map(id=>{const f=formats[id];return <button key={id} className={format===id?'selected':''} onClick={()=>setFormat(id)}><div className={`format-shape ${id}`}/><strong>{f.name}</strong><small>{f.hint}</small>{format===id&&<Check size={18}/>}</button>})}</div>
  <div className="quick-background-section"><div><h2>Choose a backdrop</h2><p>Curated to stay behind the card art, not compete with it.</p></div><div className="quick-background-grid"><button className={background==='auto'?'selected':''} onClick={()=>setBackground('auto')}><span className="quick-bg-swatch bg-auto"/><strong>Auto</strong><small>Best match</small>{background==='auto'&&<Check size={16}/>}</button>{(Object.keys(backgrounds) as Exclude<BackgroundId,'auto'>[]).map(id=>{const bg=backgrounds[id];return <button key={id} className={background===id?'selected':''} onClick={()=>setBackground(id)}><span className={`quick-bg-swatch bg-${id}`}/><strong>{bg.name}</strong><small>{bg.hint}</small>{background===id&&<Check size={16}/>}</button>})}</div></div>
  <div className="quick-sticky-actions"><button onClick={()=>setStep('result')}><Sparkles size={18}/> Create my Showcase</button></div>
 </section>;

 return <section className="quick-create-flow result">
  <div className="quick-step-head"><span>DONE ✨</span><h1>Ready for the feed</h1><p>Full-quality card art, premium layout, and subtle Tropeamine branding included.</p></div>
  <div className={`quick-result-frame ${format}`}><canvas ref={canvasRef}/></div>
  <div className="quick-result-actions"><button className="primary" onClick={shareShowcase}><Share2 size={18}/> Share Showcase</button><button onClick={savePng}><Download size={18}/> Save PNG</button><button onClick={editInStudio}><WandSparkles size={18}/> Edit in Studio</button><button onClick={()=>setStep('format')}>Change the mood</button><button onClick={()=>setStep('style')}>Try another style</button></div>
  {notice&&<p className="quick-notice">{notice}</p>}
 </section>;
}