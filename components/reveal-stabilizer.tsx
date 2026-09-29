'use client';

import {useEffect} from 'react';

export default function RevealStabilizer(){
  useEffect(()=>{
    const selector='.mystery-card-art img';

    const stabilize=(img:HTMLImageElement)=>{
      const current=img.currentSrc||img.src;
      img.dataset.revealSrc=current;
      img.style.opacity='0';
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

    scan();

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
    return()=>observer.disconnect();
  },[]);

  return null;
}
