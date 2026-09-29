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

export default function RevealStabilizer(){
  useEffect(()=>{
    const selector='.mystery-card-art img';

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
      preloads.forEach(img=>{img.src='';});
    };
  },[]);

  return null;
}
