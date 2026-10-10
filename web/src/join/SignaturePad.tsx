import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../ui/Button';

const HEIGHT = 170;

/**
 * A box to sign in with a finger, stylus or mouse. Reports a PNG (a data address with a white background) once something
 * has been drawn, or null when the box is empty or cleared.
 */
export function SignaturePad({ onChange, label = 'Your signature' }: { onChange: (png: string | null) => void; label?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [inked, setInked] = useState(false);

  const paintBackground = useCallback(() => {
    const c = canvas.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 2.5 * (c.width / c.clientWidth || 1);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.max(1, Math.round(c.clientWidth * ratio));
    c.height = Math.round(HEIGHT * ratio);
    paintBackground();
  }, [paintBackground]);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = e.currentTarget;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drawing.current = true;
    last.current = point(e);
    const ctx = e.currentTarget.getContext('2d');
    const p = last.current;
    if (ctx) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fillStyle = '#111111';
      ctx.fill();
    }
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return;
    const ctx = e.currentTarget.getContext('2d');
    const p = point(e);
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(last.current.x, last.current.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    last.current = p;
  };
  const up = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    setInked(true);
    onChange(e.currentTarget.toDataURL('image/png'));
  };
  const clear = () => {
    paintBackground();
    setInked(false);
    onChange(null);
  };

  return (
    <div className="sig">
      <div className="sig-label" id="sig-label">{label}</div>
      <canvas
        ref={canvas}
        className="sig-canvas"
        role="img"
        aria-labelledby="sig-label"
        aria-describedby="sig-help"
        style={{ height: HEIGHT }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      />
      <div className="sig-foot">
        <span id="sig-help" className="muted small">Draw with your finger or mouse.</span>
        <Button onClick={clear} disabled={!inked}>Clear</Button>
      </div>
    </div>
  );
}
