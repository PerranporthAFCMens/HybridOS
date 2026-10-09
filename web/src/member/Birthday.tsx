import { useEffect, useRef } from 'react';
import { Button } from '../ui/Button';

const COLOURS = ['#C6F135', '#6C8CFF', '#FF7A45', '#FFFFFF', '#FF5FA2'];
const SECONDS = 7;

interface Piece { x: number; y: number; vx: number; vy: number; w: number; h: number; r: number; vr: number; c: string }

/** Falling confetti on a canvas that ignores touches. Skipped for people who ask their phone for less motion. */
function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = (canvas.width = window.innerWidth);
    const h = (canvas.height = window.innerHeight);
    const pieces: Piece[] = Array.from({ length: 170 }, (_, i) => ({
      x: Math.random() * w, y: -20 - Math.random() * h * 0.6, vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 3.5,
      w: 6 + Math.random() * 7, h: 4 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, c: COLOURS[i % COLOURS.length] ?? '#fff',
    }));
    const t0 = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const el = (now - t0) / 1000;
      ctx.clearRect(0, 0, w, h);
      let alive = false;
      for (const p of pieces) {
        p.x += p.vx; p.y += p.vy; p.r += p.vr;
        if (p.y < h + 20) {
          alive = true;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.r);
          ctx.globalAlpha = Math.max(0, 1 - el / SECONDS);
          ctx.fillStyle = p.c;
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        }
      }
      if (alive && el < SECONDS) frame = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, w, h);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  return <canvas ref={ref} className="bday-confetti" aria-hidden="true" />;
}

/** "Happy birthday" with confetti, shown over the app until the member taps Thank you. */
export function BirthdayHello({ first, gymName, onClose }: { first: string; gymName: string; onClose: () => void }) {
  return (
    <>
      <Confetti />
      <div className="bday-back" role="dialog" aria-modal="true" aria-label="Happy birthday" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="bday-card">
          <span className="bday-cake" aria-hidden="true">🎂</span>
          <h2>{first ? `Happy birthday, ${first}!` : 'Happy birthday!'}</h2>
          <p>Everyone at {gymName} hopes you have a brilliant day.</p>
          <Button autoFocus variant="primary" onClick={onClose}>Thank you</Button>
        </div>
      </div>
    </>
  );
}
