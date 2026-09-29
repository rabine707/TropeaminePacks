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
  const browse = browseArtUrl(src);
  // Felicity's current source file is wider than the locked 2:3 card canvas.
  // Use the original file and stretch only this one asset to the frame so we avoid
  // both letterboxing (green bands) and left/right cropping until the source is re-uploaded at 2:3.
  const felicity = /^Felicity\b/i.test(alt);
  const useOriginal = original || felicity;
  const imageSrc = useOriginal || failed === browse ? src : browse;

  useEffect(() => {
    if (useOriginal || nearby || !enabled) return;
    if (!('IntersectionObserver' in window)) {setNearby(true); return;}
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {setNearby(true); observer.disconnect();}
    }, {rootMargin: '200px'});
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, [useOriginal, nearby, enabled]);

  return <span ref={container} style={{position: 'absolute', inset: 0}}>
    {enabled && (useOriginal || nearby) && <Image src={imageSrc} alt={alt} fill unoptimized
      loading={useOriginal ? 'eager' : 'lazy'} sizes="(max-width: 600px) 45vw, 280px"
      style={{objectFit: felicity ? 'fill' : 'contain'}} onError={() => {if (imageSrc !== src) setFailed(browse);}}/>}
  </span>;
}
