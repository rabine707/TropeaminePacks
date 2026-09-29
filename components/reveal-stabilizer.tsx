'use client';

import {useEffect} from 'react';

export default function RevealStabilizer(){
  useEffect(()=>{
    const selector='.mystery-card-art img';

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

    scan();
    document.addEventListener('pointerdown',hideCurrentBeforeAdvance,true);
    document.addEventListener('click',hideCurrentBeforeAdvance,true);

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
    };
  },[]);

  return null;
}
