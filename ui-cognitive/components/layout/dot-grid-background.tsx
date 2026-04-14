"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

import {
  isBackgroundMotionEnabledSnapshot,
  subscribeBackgroundMotion,
} from "@/lib/background-motion";

const N = 90;
const DRIFT_DOT_COUNT = 26;

interface Point {
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
}

interface DriftDot {
  x: number;
  y: number;
  radius: number;
  phase: number;
}

const COLORS = {
  dark: { dot: "rgba(91,200,245,0.72)", line: [91, 200, 245] as [number, number, number] },
  light: { dot: "rgba(26,58,107,0.66)", line: [26, 58, 107] as [number, number, number] },
};

export const DotGridBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isBackgroundMotionEnabled = useSyncExternalStore(
    subscribeBackgroundMotion,
    isBackgroundMotionEnabledSnapshot,
    () => true,
  );

  useEffect(() => {
    if (!isBackgroundMotionEnabled) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = 0;
    let H = 0;
    let pts: Point[] = [];
    let driftDots: DriftDot[] = [];
    let rafId: number;

    const resize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };

    const init = () => {
      pts = Array.from({ length: N }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        phase: Math.random() * Math.PI * 2,
      }));

      driftDots = Array.from({ length: DRIFT_DOT_COUNT }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        radius: 0.55 + Math.random() * 0.65,
        phase: Math.random() * Math.PI * 2,
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      const scheme = document.documentElement.classList.contains("dark") ? COLORS.dark : COLORS.light;
      const [r, g, b] = scheme.line;

      const drawTriangle = (x: number, y: number, size: number) => {
        ctx.beginPath();
        ctx.moveTo(x, y - size);
        ctx.lineTo(x - size * 0.9, y + size * 0.8);
        ctx.lineTo(x + size * 0.9, y + size * 0.8);
        ctx.closePath();
        ctx.fillStyle = scheme.dot;
        ctx.fill();
      };

      for (let index = 0; index < pts.length; index += 1) {
        const p = pts[index];
        p.x += p.vx;
        p.y += p.vy;
        p.phase += 0.012;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;

        const shouldDrawTriangle = index % 10 < 3;

        if (shouldDrawTriangle) {
          drawTriangle(p.x, p.y, 1.4);
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1, 0, Math.PI * 2);
          const pointAlpha = 0.42 + 0.24 * (Math.sin(p.phase) * 0.5 + 0.5);
          ctx.fillStyle = `rgba(${r},${g},${b},${pointAlpha})`;
          ctx.fill();
        }
      }

      for (const dot of driftDots) {
        dot.phase += 0.008;
        const driftAlpha = 0.1 + 0.14 * (Math.sin(dot.phase) * 0.5 + 0.5);
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${driftAlpha})`;
        ctx.fill();
      }

      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
          if (d < 150) {
            const distanceFactor = 1 - d / 150;
            const shimmer = 0.82 + 0.18 * Math.sin((pts[i].phase + pts[j].phase) * 0.5);
            const lineAlpha = Math.max(0.08, Math.min(0.55, distanceFactor * 0.5 * shimmer));
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.strokeStyle = `rgba(${r},${g},${b},${lineAlpha})`;
            ctx.lineWidth = 0.7;
            ctx.stroke();
          }
        }
      }

      rafId = requestAnimationFrame(draw);
    };

    resize();
    init();
    draw();

    const onResize = () => {
      resize();
      init();
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
    };
  }, [isBackgroundMotionEnabled]);

  if (!isBackgroundMotionEnabled) {
    return <div aria-hidden="true" className="vercel-static-background" />;
  }

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
      }}
    />
  );
};
