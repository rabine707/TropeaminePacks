'use client';

import {useEffect, useRef, useState} from 'react';
import Image from 'next/image';
import {browseArtUrl} from '@/lib/card-art';

export default function CardImage({src, alt, original = false, enabled = true}: {
  src: string; alt: string; original?: boolean; enabled?: boolean;
}) {
  const container = useRef<HTMLSpanElement>(null);
  const [nearby, setNearby] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [loadedOriginal, setLoadedOriginal] = useState<string | null>(null);
  const browse = browseArtUrl(src);
  const imageSrc = original || failed === browse ? src : browse;
  // Front artwork should always fill the locked 2:3 card shell. Correctly sized cards
  // are unaffected; odd source canvases (such as Ezra's current front) crop cleanly
  // instead of leaving large black letterbox bands. Felicity keeps the same treatment
  // on both sides because her uploaded source canvas is also wider than the shell.
  const fillShell = /\bcard artwork$/i.test(alt) || /^Felicity\b/i.test(alt);
  const fit = fillShell ? 'cover' : 'contain';

  useEffect(() => {
    setFailed(null);
    setLoadedOriginal(null);
    setNearby(original || !enabled);
  }, [src, original, enabled]);

  useEffect(() => {
    if (original || nearby || !enabled) return;
    if (!('IntersectionObserver' in window)) {setNearby(true); return;}
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {setNearby(true); observer.disconnect();}
    }, {rootMargin: '200px'});
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, [src, original, nearby, enabled]);

  return <span ref={container} style={{position: 'absolute', inset: 0, background: '#0d090d'}}>
    {enabled && original && <img
      key={src}
      src={src}
      alt={alt}
      onLoad={() => setLoadedOriginal(src)}
      onError={() => setFailed(src)}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: fit,
        objectPosition: '50% 50%',
        opacity: loadedOriginal === src ? 1 : 0,
        transition: 'opacity 90ms ease-out'
      }}
    />}
    {enabled && !original && nearby && <Image key={imageSrc} src={imageSrc} alt={alt} fill unoptimized
      loading="lazy" sizes="(max-width: 600px) 45vw, 280px"
      style={{objectFit: fit, objectPosition: '50% 50%'}} onError={() => {if (imageSrc !== src) setFailed(browse);}}/>}
    <style jsx global>{`
      /* Pack backs are selected immediately after settlement. Hide the first image paint
         long enough for that source assignment to settle so an old color cannot flash. */
      .mystery-card-art{background:#0d090d}
      .mystery-card-art img{animation:tropeamineMysterySettle 180ms ease-out both}
      @keyframes tropeamineMysterySettle{0%,55%{opacity:0}100%{opacity:1}}

      /* The pack is 3 base + 1 foil now. Do not reserve the old fifth recap column. */
      .recap-grid{grid-template-columns:repeat(4,minmax(0,1fr))!important;max-width:760px;margin-left:auto;margin-right:auto}
      @media(max-width:600px){.recap-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;max-width:100%}}
    `}</style>
  </span>;
}
