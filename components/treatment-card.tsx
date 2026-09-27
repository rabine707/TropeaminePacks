'use client';

import {useEffect, useRef, type PointerEvent, type ReactNode} from 'react';
import './treatment-card.css';

export type Treatment = 'base' | 'holo' | 'heartthrob' | 'unhinged' | 'slowburn' | 'aftercare';

/** One surface normal drives rotation, diffraction and the specular highlight. */
export default function TreatmentCard({treatment, label, children}: {
  treatment: Treatment; label: string; children: ReactNode;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const lastTime = useRef(0);
  const pointer = useRef<number | null>(null);
  const target = useRef({x: 0, y: 0, energy: 0});
  const current = useRef({x: 0, y: 0, energy: 0});
  const reduced = useRef(false);

  function animate(time: number) {
    const el = stage.current;
    if (!el) return;
    const a = current.current, b = target.current;
    const elapsed = lastTime.current ? time - lastTime.current : 16.67;
    lastTime.current = time;
    const easing = 1 - Math.exp(-elapsed / 84);
    a.x += (b.x - a.x) * easing;
    a.y += (b.y - a.y) * easing;
    a.energy += (b.energy - a.energy) * easing;
    el.style.setProperty('--rx', `${reduced.current ? 0 : -a.y * 9}deg`);
    el.style.setProperty('--ry', `${reduced.current ? 0 : a.x * 11}deg`);
    el.style.setProperty('--lx', `${50 + a.x * 39}%`);
    el.style.setProperty('--ly', `${50 + a.y * 39}%`);
    el.style.setProperty('--foil-x', `${50 - a.x * 38}%`);
    el.style.setProperty('--foil-y', `${50 - a.y * 30}%`);
    el.style.setProperty('--energy', a.energy.toFixed(3));
    frame.current = Math.abs(b.x-a.x)+Math.abs(b.y-a.y)+Math.abs(b.energy-a.energy) > .002
      ? requestAnimationFrame(animate) : 0;
  }
  function move(x: number, y: number, energy = 1) {
    target.current = {x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)), energy};
    if (!frame.current) { lastTime.current = 0; frame.current = requestAnimationFrame(animate); }
  }
  function reset() { pointer.current = null; move(0, 0, 0); }
  function track(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || (event.pointerType !== 'mouse' && pointer.current !== event.pointerId)) return;
    // Measure the untransformed stage, so tilt never changes the input coordinate space.
    const box = event.currentTarget.getBoundingClientRect();
    move((event.clientX-box.left)/box.width*2-1, (event.clientY-box.top)/box.height*2-1);
  }
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => { reduced.current = media.matches; };
    sync(); media.addEventListener('change', sync);
    return () => { media.removeEventListener('change', sync); cancelAnimationFrame(frame.current); };
  }, []);

  return <div ref={stage} className="physical-card" data-treatment={treatment}
    tabIndex={0} role="group" aria-label={`${label}, ${treatment} finish. Drag sideways or use arrow keys to move the light.`}
    onPointerDown={event => {
      if (!event.isPrimary || event.button !== 0) return;
      pointer.current = event.pointerId;
      event.currentTarget.setPointerCapture(event.pointerId);
      track(event);
    }}
    onPointerMove={track} onPointerUp={event => {
      if (pointer.current !== event.pointerId) return;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      reset();
    }}
    onPointerCancel={reset} onLostPointerCapture={reset}
    onPointerLeave={() => { if (pointer.current === null) reset(); }}
    onBlur={reset} onKeyDown={event => {
      const directions: Record<string, [number, number]> = {ArrowLeft: [-.25,0], ArrowRight: [.25,0], ArrowUp: [0,-.25], ArrowDown: [0,.25]};
      const direction = directions[event.key];
      if (direction) { event.preventDefault(); move(target.current.x+direction[0], target.current.y+direction[1]); }
      if (event.key === 'Home') { event.preventDefault(); reset(); }
    }}>
    <div className="physical-card__surface">
      {children}
      <div className="physical-card__finish" aria-hidden="true">
        <span className="physical-card__material"/>
        {treatment === 'heartthrob' && <span className="physical-card__material physical-card__material--second"/>}
        <span className="physical-card__grain"/>
        <span className="physical-card__glare"/>
      </div>
    </div>
  </div>;
}
