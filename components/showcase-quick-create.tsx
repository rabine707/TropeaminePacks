'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import {Check,Download,Share2,Sparkles,WandSparkles} from 'lucide-react';
import type {Card} from '@/lib/catalog';
import {createClient} from '@/lib/supabase/client';

type TemplateId='top6'|'series'|'recent'|'grid';
type FormatId='story'|'post'|'square';
type BackgroundId='auto'|'plum'|'midnight'|'rose'|'parchment'|'emerald'|'sapphire'|'crimson';
type BackgroundDefinition={name:string;hint:string;colors:[string,string,string];accent:string;text:string;muted:string;studioBg:'plum'|'midnight'|'paper'|'rose'};
type Step='style'|'cards'|'format'|'result';
type SavedState={cards?:Card[];wallet?:{owned?:string[]}};
type Placement={card:Card;x:number;y:number;w:number;h:number;rotation:number};
type PosterCopy={eyebrow:string;title:string;subline:string;footer:string};

const DRAFT_KEY='tropeamine-showcase-draft-v1';
const LOGO_SRC='/tropeamine-logo-light.svg';
const SERIF='"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif';
const SANS='-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
const templates:Record<TemplateId,{name:string;eyebrow:string;description:string;max:number;title:string;bg:[string,string];studioBg:'plum'|'midnight'|'rose'}>={
 top6:{name:'Top 6',eyebrow:'MY SHOWCASE',description:'Your account Showcase, turned into a polished six-card poster.',max:6,title:'MY TOP PICKS',bg:['#230f21','#6e285d'],studioBg:'plum'},
 series:{name:'Series Spotlight',eyebrow:'ONE SERIES',description:'Pick one series and let that world take over the whole frame.',max:6,title:'SERIES SPOTLIGHT',bg:['#111827','#31233f'],studioBg:'midnight'},
 recent:{name:'Recent Pulls',eyebrow:'JUST ADDED',description:'Turn your newest pulls into a fresh-drop poster for sharing.',max:6,title:'FRESH PULLS',bg:['#3b1725','#a34f72'],studioBg:'rose'},
 grid:{name:'Collection Grid',eyebrow:'BINDER GRID',description:'A clean binder-page composition for showing more of your collection at once.',max:12,title:'MY COLLECTION',bg:['#0d121a','#283244'],studioBg:'midnight'}
};

const formats:Record<FormatId,{name:string;hint:string;w:number;h:number;scale:number}>={
 story:{name:'Story',hint:'2160 × 3840 · high-res Instagram / TikTok',w:1080,h:1920,scale:2},
 post:{name:'Post',hint:'3240 × 4050 · high-res Instagram portrait',w:1080,h:1350,scale:3},
 square:{name:'Square',hint:'3240 × 3240 · high-res feed / profile',w:1080,h:1080,scale:3}
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
function baseCardId(value:string){return value.split(':')[0]||''}
function uniqueIds(values:string[]){const seen=new Set<string>();return values.filter(value=>value&&!seen.has(value)&&Boolean(seen.add(value)))}
function loadImage(src:string){return new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.crossOrigin='anonymous';img.decoding='async';img.onload=()=>resolve(img);img.onerror=reject;img.src=src})}
function roundedRect(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number){const rr=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+rr,y);ctx.arcTo(x+w,y,x+w,y+h,rr);ctx.arcTo(x+w,y+h,x,y+h,rr);ctx.arcTo(x,y+h,x,y,rr);ctx.arcTo(x,y,x+w,y,rr);ctx.closePath()}
function trackedWidth(ctx:CanvasRenderingContext2D,text:string,tracking:number){return [...text].reduce((sum,char,index)=>sum+ctx.measureText(char).width+(index<text.length-1?tracking:0),0)}
function drawTrackedText(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,tracking:number,align:'left'|'center'|'right'='left'){
 const chars=[...text],width=trackedWidth(ctx,text,tracking);let cursor=align==='center'?x-width/2:align==='right'?x-width:x;
 const previous=ctx.textAlign;ctx.textAlign='left';
 chars.forEach((char,index)=>{ctx.fillText(char,cursor,y);cursor+=ctx.measureText(char).width+(index<chars.length-1?tracking:0)});
 ctx.textAlign=previous;
}
function wrapTitle(ctx:CanvasRenderingContext2D,text:string,maxWidth:number,start:number,min:number){
 for(let size=start;size>=min;size-=2){
  ctx.font=`700 ${size}px ${SERIF}`;
  const words=text.trim().split(/\s+/),lines:string[]=[];let line='';
  for(const word of words){const next=line?`${line} ${word}`:word;if(ctx.measureText(next).width<=maxWidth||!line)line=next;else{lines.push(line);line=word}}
  if(line)lines.push(line);
  if(lines.length<=2)return{size,lines};
 }
 ctx.font=`700 ${min}px ${SERIF}`;return{size:min,lines:[text]};
}
function drawDiamond(ctx:CanvasRenderingContext2D,x:number,y:number,size:number){ctx.save();ctx.translate(x,y);ctx.rotate(Math.PI/4);ctx.fillRect(-size/2,-size/2,size,size);ctx.restore()}

function hexToRgba(hex:string,alpha:number){const value=hex.replace('#','');const n=parseInt(value.length===3?value.split('').map(c=>c+c).join(''):value,16);return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${alpha})`}
function autoBackgroundId(chosen:Card[],template:TemplateId):Exclude<BackgroundId,'auto'>{
 const text=chosen.map(card=>`${card.series} ${card.genre} ${card.hue} ${card.tags?.join(' ')||''}`).join(' ').toLowerCase();
 if(text.includes('lights out'))return 'sapphire';
 if(text.includes('caught up'))return 'crimson';
 if(text.includes('game on'))return 'emerald';
 if(/sinners retreat|slay ride|ship happens|slaughter park|sinners reunion|slaycation/.test(text))return 'rose';
 if(/butcher & blackbird|leather & lark|scythe & sparrow|ruinous/.test(text))return 'midnight';
 if(/warlock|coven king/.test(text))return 'plum';
 return ({top6:'plum',series:'midnight',recent:'rose',grid:'midnight'} as const)[template];
}

export default function ShowcaseQuickCreate(){
 const canvasRef=useRef<HTMLCanvasElement>(null);
 const [step,setStep]=useState<Step>('style');
 const [template,setTemplate]=useState<TemplateId>('top6');
 const [background,setBackground]=useState<BackgroundId>('auto');
 const [format,setFormat]=useState<FormatId>('post');
 const [cards,setCards]=useState<Card[]>([]);
 const [owned,setOwned]=useState<string[]>([]);
 const [selected,setSelected]=useState<string[]>([]);
 const [seriesFilter,setSeriesFilter]=useState('All series');
 const [search,setSearch]=useState('');
 const [notice,setNotice]=useState('');
 const [localDataReady,setLocalDataReady]=useState(false);
 const [accountDataReady,setAccountDataReady]=useState(false);
 const [accountShowcase,setAccountShowcase]=useState<string[]>([]);
 const [accountShowcaseTitle,setAccountShowcaseTitle]=useState('MY TOP PICKS');
 const [recentAcquired,setRecentAcquired]=useState<string[]>([]);
 const [pendingAutoSource,setPendingAutoSource]=useState<TemplateId|null>(null);
 const activeTemplate=templates[template];
 const dims=formats[format];

 useEffect(()=>{
  try{
   const raw=localStorage.getItem('tropeamine-packs-v1');
   if(raw){
    const parsed=JSON.parse(raw) as SavedState;
    setCards(Array.isArray(parsed.cards)?parsed.cards:[]);
    setOwned(Array.isArray(parsed.wallet?.owned)?parsed.wallet!.owned!.filter(id=>!id.includes(':')):[]);
   }
  }catch{}
  setLocalDataReady(true);
 },[]);

 useEffect(()=>{
  let active=true;
  (async()=>{
   try{
    const client=createClient();
    const {data:{user}}=await client.auth.getUser();
    if(!active||!user)return;
    const [progressResult,recentResult]=await Promise.all([
     client.from('collector_progress').select('showcase,showcase_title').eq('user_id',user.id).maybeSingle(),
     client.from('collection_items').select('card_id,acquired_at').eq('user_id',user.id).order('acquired_at',{ascending:false}).limit(30)
    ]);
    if(!active)return;
    const showcase=Array.isArray(progressResult.data?.showcase)?progressResult.data.showcase.map(value=>baseCardId(String(value))):[];
    setAccountShowcase(uniqueIds(showcase));
    const title=String(progressResult.data?.showcase_title||'').trim();
    if(title)setAccountShowcaseTitle(title);
    const recent=(recentResult.data??[]).map(row=>String(row.card_id||'')).filter(id=>id&&!id.includes(':treatment:')).map(baseCardId);
    setRecentAcquired(uniqueIds(recent).slice(0,6));
   }catch{}
   finally{if(active)setAccountDataReady(true)}
  })();
  return()=>{active=false};
 },[]);

 const ownedCards=useMemo(()=>cards.filter(c=>owned.includes(c.id)).filter(c=>!c.adult&&!c.tags?.includes('Mature Content')),[cards,owned]);
 const ownedSeries=useMemo(()=>Array.from(new Set(ownedCards.map(c=>c.series).filter(Boolean))).sort(),[ownedCards]);
 const series=useMemo(()=>['All series',...ownedSeries],[ownedSeries]);
 const filteredCards=useMemo(()=>ownedCards.filter(c=>(template!=='series'||Boolean(seriesFilter))&&(seriesFilter==='All series'||c.series===seriesFilter)).filter(c=>`${c.name} ${c.series}`.toLowerCase().includes(search.toLowerCase())),[ownedCards,seriesFilter,search,template]);
 const chosen=selected.map(id=>ownedCards.find(c=>c.id===id)).filter((c):c is Card=>Boolean(c));

 useEffect(()=>{
  if(!localDataReady||!accountDataReady||!pendingAutoSource)return;
  const source=pendingAutoSource==='top6'?accountShowcase:recentAcquired;
  const ownedSet=new Set(ownedCards.map(card=>card.id));
  const picks=source.filter(id=>ownedSet.has(id)).slice(0,templates[pendingAutoSource].max);
  setSelected(picks);
  if(pendingAutoSource==='top6')setNotice(picks.length?`Loaded ${picks.length} card${picks.length===1?'':'s'} from your account Showcase.`:'Your account Showcase is empty. Pick up to 6 cards from your binder.');
  else setNotice(picks.length?`Loaded your ${picks.length} most recently acquired card${picks.length===1?'':'s'}.`:'No recent acquisitions yet. Pick cards from your binder.');
  setPendingAutoSource(null);
 },[localDataReady,accountDataReady,pendingAutoSource,accountShowcase,recentAcquired,ownedCards]);

 const resolvedBackgroundId=background==='auto'?autoBackgroundId(chosen,template):background;
 const activeBackground=backgrounds[resolvedBackgroundId];
 useEffect(()=>{if(step==='result')void renderCanvas()},[step,template,format,background,selected,cards]);

 function chooseTemplate(id:TemplateId){
  setTemplate(id);setSearch('');setStep('cards');setNotice('');setPendingAutoSource(null);
  if(id==='series'){setSeriesFilter('');setSelected([]);setNotice('Choose a series first. We’ll load the cards you own from it.');return}
  setSeriesFilter('All series');
  if(id==='top6'||id==='recent'){
   setSelected([]);setPendingAutoSource(id);
   if(!accountDataReady)setNotice(id==='top6'?'Loading your account Showcase…':'Loading your recent collection history…');
   return;
  }
  setSelected(current=>current.slice(0,templates[id].max));
 }
 function chooseSeries(name:string){
  setSeriesFilter(name);
  const picks=ownedCards.filter(card=>card.series===name).slice(0,templates.series.max).map(card=>card.id);
  setSelected(picks);
  setNotice(picks.length?`Loaded ${picks.length} collected ${name} card${picks.length===1?'':'s'}. Tap cards below to adjust.`:`You don’t own any ${name} cards yet.`);
 }
 function toggleCard(id:string){setSelected(current=>{if(current.includes(id))return current.filter(x=>x!==id);if(current.length>=activeTemplate.max){setNotice(`${activeTemplate.name} holds up to ${activeTemplate.max} cards.`);return current}setNotice('');return [...current,id]})}
 function surpriseMe(){const pool=[...filteredCards].sort(()=>Math.random()-.5).slice(0,Math.min(activeTemplate.max,6,filteredCards.length));setSelected(pool.map(c=>c.id));setNotice(pool.length?'Picked a set for you ✨':'No collected cards found in this filter.')}
 function showcaseTitle(){
  if(template==='series'){const names=Array.from(new Set(chosen.map(c=>c.series).filter(Boolean)));if(names.length===1)return names[0].toUpperCase()}
  if(template==='top6'&&accountShowcaseTitle.trim())return accountShowcaseTitle.trim().toUpperCase();
  return activeTemplate.title;
 }
 function posterCopy():PosterCopy{
  if(template==='series')return{eyebrow:'SERIES SPOTLIGHT',title:showcaseTitle(),subline:(chosen[0]?.author||'ONE WORLD · ONE OBSESSION').toUpperCase(),footer:`${chosen.length} COLLECTED FROM THIS WORLD`};
  if(template==='recent')return{eyebrow:'JUST PULLED',title:'FRESH PULLS',subline:'NEW ADDITIONS TO THE BINDER',footer:`${chosen.length} NEW CARD${chosen.length===1?'':'S'} · FRESH FROM MY COLLECTION`};
  if(template==='grid')return{eyebrow:'FROM MY BINDER',title:'THE COLLECTION',subline:'A PAGE FROM MY PERSONAL ARCHIVE',footer:`${chosen.length} CARD${chosen.length===1?'':'S'} · ONE COLLECTION`};
  return{eyebrow:'CURRENT OBSESSIONS',title:showcaseTitle(),subline:'THE CARDS I KEEP COMING BACK TO',footer:`${chosen.length} FAVORITE${chosen.length===1?'':'S'} · MY SHOWCASE`};
 }
 function step2Copy(){
  if(template==='top6')return `Your account Showcase is loaded. Reorder it or swap cards before sharing. ${selected.length}/${activeTemplate.max} selected.`;
  if(template==='series')return seriesFilter?`${seriesFilter} only. Pick up to ${activeTemplate.max} cards and tap in the order you want them featured.`:'Choose one of your collected series below to continue.';
  if(template==='recent')return `Your most recently acquired cards are loaded. Adjust them if you want. ${selected.length}/${activeTemplate.max} selected.`;
  return `Choose up to ${activeTemplate.max} owned cards for one clean binder-style grid. ${selected.length}/${activeTemplate.max} selected.`;
 }

 function placements(width:number,height:number){
  const list=chosen,count=list.length,result:Placement[]=[];
  if(!count)return result;

  const top=height*(format==='story' ? .205 : format==='post' ? .225 : .245),bottom=height*.885;
  const areaH=bottom-top,padX=width*(format==='story'?.075:.065),usableW=width-padX*2;
  const gapX=Math.max(30,width*.034),gapY=Math.max(30,height*.024);
  const maxCols=Math.min(template==='grid'?4:3,count);
  let best:{cols:number;rows:number;cardW:number}|null=null;

  for(let cols=1;cols<=maxCols;cols++){
   if(count>1&&cols===1)continue;
   const rows=Math.ceil(count/cols);
   const widthLimit=(usableW-gapX*(cols-1))/cols;
   const heightLimit=(areaH-gapY*(rows-1))/rows/1.5;
   let cardW=Math.min(widthLimit,heightLimit);
   if(count===1)cardW=Math.min(cardW,width*.60);
   else if(count===2)cardW=Math.min(cardW,width*.40);
   else if(count===3)cardW=Math.min(cardW,width*.285);
   if(cardW<=0)continue;
   if(!best||cardW>best.cardW+1||(Math.abs(cardW-best.cardW)<=1&&cols<best.cols))best={cols,rows,cardW};
  }

  if(!best)return result;
  const {cols,rows,cardW}=best,cardH=cardW*1.5;
  const totalH=rows*cardH+(rows-1)*gapY;
  const firstY=top+(areaH-totalH)/2+cardH/2;
  let index=0;

  for(let row=0;row<rows;row++){
   const remaining=count-index,rowCount=Math.min(cols,remaining);
   const rowW=rowCount*cardW+(rowCount-1)*gapX;
   const firstX=(width-rowW)/2+cardW/2;
   for(let col=0;col<rowCount;col++){
    const card=list[index++];
    result.push({card,x:firstX+col*(cardW+gapX),y:firstY+row*(cardH+gapY),w:cardW,h:cardH,rotation:0});
   }
  }
  return result;
 }

 function paintBackground(ctx:CanvasRenderingContext2D){
  const [a,b,c]=activeBackground.colors;
  const base=ctx.createLinearGradient(0,0,dims.w,dims.h);base.addColorStop(0,a);base.addColorStop(.54,b);base.addColorStop(1,c);ctx.fillStyle=base;ctx.fillRect(0,0,dims.w,dims.h);
  const glow=ctx.createRadialGradient(dims.w*.5,dims.h*.16,0,dims.w*.5,dims.h*.16,dims.w*.8);glow.addColorStop(0,hexToRgba(activeBackground.accent,.18));glow.addColorStop(.45,hexToRgba(activeBackground.accent,.055));glow.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,dims.w,dims.h);
  const vignette=ctx.createRadialGradient(dims.w*.5,dims.h*.48,dims.w*.2,dims.w*.5,dims.h*.48,dims.h*.72);vignette.addColorStop(.45,'rgba(0,0,0,0)');vignette.addColorStop(1,resolvedBackgroundId==='parchment'?'rgba(76,42,36,.16)':'rgba(0,0,0,.34)');ctx.fillStyle=vignette;ctx.fillRect(0,0,dims.w,dims.h);
  ctx.fillStyle=resolvedBackgroundId==='parchment'?'rgba(74,40,45,.065)':'rgba(255,255,255,.045)';for(let i=0;i<30;i++){ctx.beginPath();ctx.arc((i*173+37)%dims.w,(i*281+61)%dims.h,1.5+(i%4),0,Math.PI*2);ctx.fill()}
 }

 function drawPosterHeader(ctx:CanvasRenderingContext2D,logo:HTMLImageElement|null){
  const copy=posterCopy(),pad=format==='story'?72:60,top=format==='story'?72:58,maxTitleWidth=dims.w-pad*2;
  ctx.textBaseline='middle';
  ctx.fillStyle='rgba(255,255,255,.13)';ctx.strokeStyle='rgba(255,255,255,.14)';ctx.lineWidth=2;ctx.strokeRect(28,28,dims.w-56,dims.h-56);
  ctx.fillStyle=activeBackground.accent;drawDiamond(ctx,pad,top,8);
  ctx.font=`700 ${format==='story'?18:16}px ${SANS}`;ctx.fillStyle=activeBackground.text;drawTrackedText(ctx,copy.eyebrow,pad+20,top,3.4,'left');
  if(logo){
   const logoW=format==='story'?214:190,logoH=logoW*(78/320);
   ctx.save();ctx.globalAlpha=.92;ctx.drawImage(logo,dims.w-pad-logoW,top-logoH/2,logoW,logoH);ctx.restore();
  }else{
   ctx.font=`700 ${format==='story'?17:15}px ${SANS}`;ctx.fillStyle='rgba(255,255,255,.72)';drawTrackedText(ctx,'TROPEAMINE PACKS',dims.w-pad,top,2.4,'right');
  }
  const titleStart=format==='story'?78:66,min=format==='square'?34:38,{size,lines}=wrapTitle(ctx,copy.title,maxTitleWidth,titleStart,min),lineHeight=size*.94;
  ctx.font=`700 ${size}px ${SERIF}`;ctx.fillStyle=activeBackground.text;ctx.textAlign='left';ctx.shadowColor='rgba(0,0,0,.32)';ctx.shadowBlur=16;
  const titleY=top+(format==='story'?66:58);lines.forEach((line,index)=>ctx.fillText(line,pad,titleY+index*lineHeight));ctx.shadowBlur=0;
  const subY=titleY+(lines.length-1)*lineHeight+size*.78;
  ctx.font=`700 ${format==='story'?17:15}px ${SANS}`;ctx.fillStyle=activeBackground.muted;drawTrackedText(ctx,copy.subline,pad,subY,2.2,'left');
  const ruleY=subY+(format==='story'?34:27);ctx.strokeStyle='rgba(237,183,215,.38)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(pad,ruleY);ctx.lineTo(dims.w-pad,ruleY);ctx.stroke();
  ctx.fillStyle=activeBackground.accent;drawDiamond(ctx,dims.w-pad,ruleY,7);
 }

 async function renderCanvas(){
  const canvas=canvasRef.current;if(!canvas)return;
  canvas.width=dims.w*dims.scale;canvas.height=dims.h*dims.scale;
  const ctx=canvas.getContext('2d');if(!ctx)return;
  ctx.setTransform(dims.scale,0,0,dims.scale,0,0);
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  paintBackground(ctx);
  const logo=await loadImage(LOGO_SRC).catch(()=>null);
  drawPosterHeader(ctx,logo);
  for(const item of placements(dims.w,dims.h)){
   ctx.save();ctx.translate(item.x,item.y);ctx.rotate(item.rotation*Math.PI/180);ctx.shadowColor='rgba(0,0,0,.5)';ctx.shadowBlur=28;ctx.shadowOffsetY=15;
   const x=-item.w/2,y=-item.h/2;roundedRect(ctx,x,y,item.w,item.h,16);ctx.fillStyle='rgba(255,255,255,.11)';ctx.fill();ctx.clip();
   if(item.card.image){try{const img=await loadImage(item.card.image);ctx.drawImage(img,x,y,item.w,item.h)}catch{ctx.fillStyle='rgba(255,255,255,.08)';ctx.fillRect(x,y,item.w,item.h)}}
   ctx.restore();
  }
  const copy=posterCopy(),footerY=dims.h-60,pad=format==='story'?72:60;
  ctx.strokeStyle='rgba(255,255,255,.12)';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(pad,footerY-26);ctx.lineTo(dims.w-pad,footerY-26);ctx.stroke();
  ctx.font=`700 ${format==='story'?15:14}px ${SANS}`;ctx.fillStyle=activeBackground.muted;drawTrackedText(ctx,copy.footer,pad,footerY,1.7,'left');
  ctx.fillStyle=activeBackground.text;drawTrackedText(ctx,'COLLECT YOUR OBSESSION',dims.w-pad,footerY,1.7,'right');
 }

 function canvasBlob(){return new Promise<Blob|null>(resolve=>{const canvas=canvasRef.current;if(!canvas){resolve(null);return}canvas.toBlob(resolve,'image/png')})}
 async function savePng(){const blob=await canvasBlob();if(!blob)return;const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`tropeamine-showcase-${Date.now()}.png`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice(`High-resolution PNG saved at ${dims.w*dims.scale} × ${dims.h*dims.scale}.`)}
 async function shareShowcase(){const blob=await canvasBlob();if(!blob)return;const file=new File([blob],'tropeamine-showcase.png',{type:'image/png'});try{if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){await navigator.share({title:'My Tropeamine Packs Showcase',files:[file]});setNotice('Shared ✨');return}}catch(err){if((err as DOMException)?.name==='AbortError')return}await savePng();setNotice('Native sharing is not available here, so the high-resolution PNG was saved instead.')}

 function editInStudio(){
  const source=placements(dims.w,dims.h),copy=posterCopy();
  const studioPreset=format==='square'?'square':'story',studioW=1080,studioH=studioPreset==='square'?1080:1920,sx=studioW/dims.w,sy=studioH/dims.h;
  const elements=[...source.map((p,i)=>({id:uid(),kind:'card' as const,cardId:p.card.id,side:'front' as const,x:p.x*sx,y:p.y*sy,w:p.w*sx,h:p.h*sx,rotation:0,z:i+1,locked:false})),
   {id:uid(),kind:'text' as const,text:copy.eyebrow,x:240,y:75*sy,size:20,rotation:0,z:48,locked:true},
   {id:uid(),kind:'text' as const,text:copy.title,x:310,y:145*sy,size:54,rotation:0,z:49,locked:true},
   {id:uid(),kind:'text' as const,text:'TROPEAMINE PACKS',x:865,y:75*sy,size:24,rotation:0,z:50,locked:true}];
  try{localStorage.setItem(DRAFT_KEY,JSON.stringify({preset:studioPreset,bg:activeBackground.studioBg,elements,snap:true}))}catch{}
  window.location.href='/showcase/create';
 }

 if(step==='style')return <section className="quick-create-flow">
  <div className="quick-step-head"><span>STEP 1 OF 3</span><h1>Pick a style</h1><p>Choose what you want to show. The typography, spacing, and composition are already art-directed for you.</p></div>
  <div className="quick-template-grid">{(Object.keys(templates) as TemplateId[]).map(id=>{const item=templates[id];return <button key={id} className={`quick-template-card ${id==='top6'?'featured':''}`} onClick={()=>chooseTemplate(id)}><span>{item.eyebrow}</span><div className={`quick-template-preview preview-${id}`}><i/><i/><i/><i/><i/><i/></div><strong>{item.name}</strong><small>{item.description}</small></button>})}</div>
  <a className="quick-secondary-link" href="/showcase/create">Prefer full control? Open Studio →</a>
 </section>;

 if(step==='cards')return <section className="quick-create-flow">
  <div className="quick-step-head"><button className="quick-back" onClick={()=>setStep('style')}>← Styles</button><span>STEP 2 OF 3</span><h1>{template==='series'&&!seriesFilter?'Choose a series':'Pick your cards'}</h1><p>{step2Copy()}</p></div>
  {template==='series'&&<div className="quick-series-picker"><div className="quick-series-picker-head"><div><span>YOUR COLLECTED SERIES</span><strong>Pick the world to spotlight.</strong></div><small>Only series with cards in your binder appear here.</small></div><div className="quick-series-options">{ownedSeries.map(name=>{const count=ownedCards.filter(card=>card.series===name).length;return <button key={name} className={seriesFilter===name?'selected':''} onClick={()=>chooseSeries(name)}><strong>{name}</strong><small>{count} collected</small>{seriesFilter===name&&<Check size={16}/>}</button>})}</div></div>}
  {(template!=='series'||Boolean(seriesFilter))&&<div className="quick-card-tools"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search your collection…"/>{template!=='series'&&<select value={seriesFilter} onChange={e=>setSeriesFilter(e.target.value)}>{series.map(s=><option key={s}>{s}</option>)}</select>}<button onClick={surpriseMe}><Sparkles size={16}/> Surprise me</button></div>}
  {!ownedCards.length?<div className="quick-empty"><WandSparkles/><strong>Your binder is waiting.</strong><p>Collect a card first, then come back to turn it into something shareable.</p><a href="/packs">Open packs</a></div>:template==='series'&&!seriesFilter?<div className="quick-series-empty"><strong>Choose a series above.</strong><p>Then we’ll load up to six cards you own from it.</p></div>:<div className="quick-card-grid">{filteredCards.map(card=>{const order=selected.indexOf(card.id);return <button key={card.id} className={order>=0?'selected':''} onClick={()=>toggleCard(card.id)}><span className="quick-card-art">{card.image?<img src={card.image} alt=""/>:<i/>}{order>=0&&<b>{order+1}</b>}</span><small>{card.name}</small><em>{card.series}</em></button>})}</div>}
  {notice&&<p className="quick-notice">{notice}</p>}
  <div className="quick-sticky-actions"><button disabled={!selected.length} onClick={()=>setStep('format')}>Continue with {selected.length||'your'} card{selected.length===1?'':'s'} →</button></div>
 </section>;

 if(step==='format')return <section className="quick-create-flow narrow">
  <div className="quick-step-head"><button className="quick-back" onClick={()=>setStep('cards')}>← Cards</button><span>STEP 3 OF 3</span><h1>Where are you sharing?</h1><p>Choose the crop. We’ll rebuild the composition for that exact ratio.</p></div>
  <div className="quick-format-grid">{(Object.keys(formats) as FormatId[]).map(id=>{const f=formats[id];return <button key={id} className={format===id?'selected':''} onClick={()=>setFormat(id)}><div className={`format-shape ${id}`}/><strong>{f.name}</strong><small>{f.hint}</small>{format===id&&<Check size={18}/>}</button>})}</div>
  <div className="quick-background-section"><div><h2>Choose a backdrop</h2><p>Curated to stay behind the card art, not compete with it.</p></div><div className="quick-background-grid"><button className={background==='auto'?'selected':''} onClick={()=>setBackground('auto')}><span className="quick-bg-swatch bg-auto"/><strong>Auto</strong><small>Best match</small>{background==='auto'&&<Check size={16}/>}</button>{(Object.keys(backgrounds) as Exclude<BackgroundId,'auto'>[]).map(id=>{const bg=backgrounds[id];return <button key={id} className={background===id?'selected':''} onClick={()=>setBackground(id)}><span className={`quick-bg-swatch bg-${id}`}/><strong>{bg.name}</strong><small>{bg.hint}</small>{background===id&&<Check size={16}/>}</button>})}</div></div>
  <div className="quick-sticky-actions"><button onClick={()=>setStep('result')}><Sparkles size={18}/> Create my Showcase</button></div>
 </section>;

 return <section className="quick-create-flow result">
  <div className="quick-step-head"><span>DONE ✨</span><h1>Your Showcase is ready</h1><p>Art-directed typography, high-resolution card art, and Tropeamine branding are already baked in.</p></div>
  <div className={`quick-result-frame ${format}`}><canvas ref={canvasRef}/></div>
  <div className="quick-result-actions"><button className="primary" onClick={shareShowcase}><Share2 size={18}/> Share Showcase</button><button onClick={savePng}><Download size={18}/> Save PNG</button><button onClick={editInStudio}><WandSparkles size={18}/> Edit cards in Studio</button><button onClick={()=>setStep('format')}>Change the mood</button><button onClick={()=>setStep('style')}>Try another style</button></div>
  {notice&&<p className="quick-notice">{notice}</p>}
 </section>;
}