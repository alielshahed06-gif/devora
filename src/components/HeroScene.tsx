'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

const ORDER: [string, string][] = [['b2', 'التعفّن الدماغي'], ['b1', 'الذكاء الاصطناعي ببساطة'], ['b3', 'Computer Science — C++']];

/** Rotating 3D book showcase (same classes/animation as the original). Pointer tilt disabled for reduced-motion. */
export function HeroScene() {
  const [cur, setCur] = useState(0);
  const stage = useRef<HTMLDivElement>(null), scene = useRef<HTMLDivElement>(null);
  useEffect(() => { const t = setInterval(() => setCur((c) => (c + 1) % ORDER.length), 4500); return () => clearInterval(t); }, []);
  useEffect(() => {
    const sc = scene.current, st = stage.current; if (!sc || !st || matchMedia('(prefers-reduced-motion:reduce)').matches) return;
    const move = (e: PointerEvent) => { const r = sc.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5; st.style.setProperty('--ry', -14 + x * 36 + 'deg'); st.style.setProperty('--rx', -6 - y * 24 + 'deg'); };
    const leave = () => { st.style.removeProperty('--ry'); st.style.removeProperty('--rx'); };
    sc.addEventListener('pointermove', move); sc.addEventListener('pointerleave', leave);
    return () => { sc.removeEventListener('pointermove', move); sc.removeEventListener('pointerleave', leave); };
  }, []);
  return (
    <div className="scene" id="scene" ref={scene}>
      <div className="orbit" aria-hidden="true" />
      <div className="stage" id="stage" ref={stage}>
        <div className="books">{ORDER.map(([id, title], i) => (
          <Link key={id} className={`bk${i === cur ? ' on' : ''}`} href={`/product/${id}`} aria-label={title}><Image src={`/brand/${id}.webp`} alt={title} width={500} height={700} sizes="(max-width: 700px) 42vw, 360px" priority={i === 0} /></Link>
        ))}</div>
      </div>
      <div className="shadow3d" aria-hidden="true" />
    </div>
  );
}
