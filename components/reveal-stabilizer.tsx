'use client';

import {useEffect} from 'react';

const mysteryBackSources=[
  '/card-backs/162A9E6A-1EDD-4577-9146-77A182E20598.png',
  '/card-backs/2DAD99D8-884D-4CD0-A564-10DF78C2F37E.png',
  '/card-backs/2EFE84AE-C0D2-4FDD-81FD-8543082253FE.png',
  '/card-backs/2F338503-CD2A-4FFD-BEEC-82E48929DE4D.png',
  '/card-backs/67FE1CAD-9601-47BC-959B-ACB6F6B2CAC7.png',
  '/card-backs/6E676BE7-114E-419E-923E-B6AA7F5345A5.png',
  '/card-backs/B9444DB0-00C3-4DC0-8D15-CFE4D1D9262B.png',
  '/card-backs/F0B2B3BC-A47A-4C59-ACE7-5EA5F8E05966.png',
];

const ADVANCE_GUARD_MS=300;

export default function RevealStabilizer(){
  useEffect(()=>{
    const selector='.mystery-card-art img';
    let lastAdvanceAt=0;
    let forwardingStageClick=false;

    // Warm every mystery-back asset once so the next selected edition is already
    // fetched and decoded before the reveal advances to it.
    const preloads=mysteryBackSources.map(src=>{
      const img=new Image();
      img.decoding='async';
      img.src=src;
      void img.decode().catch(()=>{});
      return img;
    });

    const hide=(img:HTMLImageElement)=>{
      img.style.opacity='0';
    };

    const stabilize=(img:HTMLImageElement)=>{
      const current=img.currentSrc||img.src;
      img.dataset.revealSrc=current;
      hide(img);
      img.style.transition='opacity 120ms ease';

      const show=()=>{
        const now=img.currentSrc||img.src;
        if(img.dataset.revealSrc===now){
          img.style.opacity='1';
        }
      };

      if(img.complete&&img.naturalWidth>0) requestAnimationFrame(show);
      else img.addEventListener('load',show,{once:true});
    };

    const scan=(root:ParentNode=document)=>{
      root.querySelectorAll<HTMLImageElement>(selector).forEach(stabilize);
    };

    const hideCurrentBeforeAdvance=(event:Event)=>{
      const target=event.target;
      if(!(target instanceof Element))return;
      const stage=target.closest('.cinematic-card-stage');
      if(!stage?.classList.contains('face-back'))return;
      document.querySelectorAll<HTMLImageElement>(selector).forEach(hide);
    };

    const isProtectedControl=(target:Element,stage:HTMLElement)=>{
      const control=target.closest('button,a,input,select,textarea,label,[role="button"]');
      return Boolean(control&&control!==stage&&!stage.contains(control));
    };

    // The card button remains the source of truth for reveal state. On phones we
    // simply forward taps from the surrounding cinematic surface to that button.
    // This keeps Mystery -> Front -> Back -> Next Card logic in CollectionApp.
    const advanceFromRevealSurface=(event:PointerEvent)=>{
      if(event.button!==0)return;
      const target=event.target;
      if(!(target instanceof Element))return;
      const reveal=target.closest('.cinematic-reveal');
      if(!reveal)return;
      const stage=reveal.querySelector<HTMLElement>('.cinematic-card-stage');
      if(!stage||stage.getAttribute('aria-disabled')==='true')return; // recap or inactive state
      if(stage.contains(target))return; // existing card click already advances
      if(isProtectedControl(target,stage))return; // close, Reveal all, links, etc.

      const now=performance.now();
      if(now-lastAdvanceAt<ADVANCE_GUARD_MS){
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      lastAdvanceAt=now;
      event.preventDefault();
      event.stopPropagation();
      forwardingStageClick=true;
      stage.click();
      forwardingStageClick=false;
    };

    // Guard rapid direct taps on the card itself as well, so an excited double-tap
    // cannot skip from the mystery back straight through the front artwork.
    const guardDirectStageClick=(event:MouseEvent)=>{
      const target=event.target;
      if(!(target instanceof Element))return;
      const stage=target.closest<HTMLElement>('.cinematic-card-stage');
      if(!stage||forwardingStageClick)return;
      const now=performance.now();
      if(now-lastAdvanceAt<ADVANCE_GUARD_MS){
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      lastAdvanceAt=now;
    };

    const style=document.createElement('style');
    style.dataset.revealTapAnywhere='true';
    style.textContent=`
      .cinematic-reveal{touch-action:manipulation;-webkit-tap-highlight-color:transparent;user-select:none;}
      .cinematic-reveal:has(.cinematic-card-stage){cursor:pointer;}
      @media (max-width:600px){
        .modal.wide:has(.cinematic-reveal){padding-inline:10px;}
        .cinematic-reveal:has(.cinematic-card-stage){min-height:calc(100dvh - 36px);display:flex;flex-direction:column;justify-content:center;}
        .cinematic-reveal-controls{width:100%;min-height:52px;display:flex;align-items:center;justify-content:center;}
        .cinematic-hint{pointer-events:none;}
      }
    `;
    document.head.appendChild(style);

    scan();
    document.addEventListener('pointerdown',hideCurrentBeforeAdvance,true);
    document.addEventListener('click',hideCurrentBeforeAdvance,true);
    document.addEventListener('pointerup',advanceFromRevealSurface,true);
    document.addEventListener('click',guardDirectStageClick,true);

    const observer=new MutationObserver(records=>{
      for(const record of records){
        if(record.type==='attributes'&&record.target instanceof HTMLImageElement&&record.target.matches(selector)){
          stabilize(record.target);
          continue;
        }
        record.addedNodes.forEach(node=>{
          if(!(node instanceof HTMLElement))return;
          if(node.matches(selector))stabilize(node as HTMLImageElement);
          scan(node);
        });
      }
    });

    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['src','srcset']});
    return()=>{
      observer.disconnect();
      document.removeEventListener('pointerdown',hideCurrentBeforeAdvance,true);
      document.removeEventListener('click',hideCurrentBeforeAdvance,true);
      document.removeEventListener('pointerup',advanceFromRevealSurface,true);
      document.removeEventListener('click',guardDirectStageClick,true);
      style.remove();
      preloads.forEach(img=>{img.src='';});
    };
  },[]);

  return null;
}
