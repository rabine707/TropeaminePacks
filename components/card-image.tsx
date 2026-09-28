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
  const imageSrc = original || failed === browse ? src : browse;

  useEffect(() => {
    if (original || nearby || !enabled) return;
    if (!('IntersectionObserver' in window)) {setNearby(true); return;}
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {setNearby(true); observer.disconnect();}
    }, {rootMargin: '200px'});
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, [original, nearby, enabled]);

  return <span ref={container} style={{position: 'absolute', inset: 0}}>
    {enabled && (original || nearby) && <Image src={imageSrc} alt={alt} fill unoptimized
      loading={original ? 'eager' : 'lazy'} sizes="(max-width: 600px) 45vw, 280px"
      style={{objectFit: 'cover'}} onError={() => {if (imageSrc !== src) setFailed(browse);}}/>}
  </span>;
}
