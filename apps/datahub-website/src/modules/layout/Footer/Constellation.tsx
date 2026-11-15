import { useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import { useReducedMotion } from 'framer-motion';

interface ConstellationProps {
  starColor: string;
  lineColor: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

/*
 * Dependency-free port of the original footer's particles.js "constellation" effect
 * (wp-content/themes/mitech/assets/js/constellation.js): 80 particles per 800×800px area,
 * radius ≤ 3px, speed 6, links within 150px, and a "grab" hover within 140px.
 */
const DENSITY_AREA = 800 * 800;
const BASE_COUNT = 80;
const LINK_DISTANCE = 150;
const GRAB_DISTANCE = 140;
const SPEED = 6;

const hexToRgb = (hex: string) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
};

export function Constellation({ starColor, lineColor }: ConstellationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const lineRgb = hexToRgb(lineColor);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    let frame = 0;
    let visible = true;
    const mouse = { x: -9999, y: -9999 };

    const create = (): Particle => {
      // particles.js: velocity is random direction scaled by speed / 10 per frame.
      const angle = Math.random() * Math.PI * 2;
      const v = (Math.random() * SPEED) / 10;
      return { x: Math.random() * width, y: Math.random() * height, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v, r: Math.random() * 3 };
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round((BASE_COUNT * width * height) / DENSITY_AREA);
      particles = Array.from({ length: count }, create);
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i]!;
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j]!;
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < LINK_DISTANCE) {
            ctx.strokeStyle = `rgba(${lineRgb}, ${1 - d / LINK_DISTANCE})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
        const dm = Math.hypot(a.x - mouse.x, a.y - mouse.y);
        if (dm < GRAB_DISTANCE) {
          ctx.strokeStyle = `rgba(${lineRgb}, ${1 - dm / GRAB_DISTANCE})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }
      }
      ctx.fillStyle = starColor;
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const step = () => {
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        // out_mode "out": wrap around the edges.
        if (p.x < -p.r) p.x = width + p.r;
        else if (p.x > width + p.r) p.x = -p.r;
        if (p.y < -p.r) p.y = height + p.r;
        else if (p.y > height + p.r) p.y = -p.r;
      }
      draw();
      if (visible) frame = requestAnimationFrame(step);
    };

    resize();
    draw();

    const observer = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      cancelAnimationFrame(frame);
      if (visible && !reduceMotion) frame = requestAnimationFrame(step);
    });
    observer.observe(canvas);

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };
    const onLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };
    const resizeObserver = new ResizeObserver(() => {
      resize();
      draw();
    });
    resizeObserver.observe(canvas);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerleave', onLeave);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      resizeObserver.disconnect();
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
    };
  }, [starColor, lineColor, reduceMotion]);

  return (
    <Box
      component="canvas"
      ref={canvasRef}
      aria-hidden="true"
      sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
    />
  );
}
