"use client";

import Image from "next/image";
import { type PointerEvent, useRef } from "react";

interface WhaleBannerProps {
  status: "online" | "offline" | "loading";
  latencyMs: number | null;
}

const BANNER_VERSION = "2026-04-14";

export function WhaleBanner({ status, latencyMs }: WhaleBannerProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);

  const statusColor =
    status === "online"
      ? "bg-emerald-500"
      : status === "offline"
        ? "bg-red-500"
        : "animate-pulse bg-[var(--border)]";

  const statusLabel =
    status === "online"
      ? "online"
      : status === "offline"
        ? "offline"
        : "conectando";

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") {
      return;
    }

    const card = cardRef.current;
    if (!card) {
      return;
    }

    const rect = card.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const px = x / rect.width;
    const py = y / rect.height;

    const rotateY = (px - 0.5) * 5;
    const rotateX = (0.5 - py) * 4;

    card.style.setProperty("--mx", `${x.toFixed(2)}px`);
    card.style.setProperty("--my", `${y.toFixed(2)}px`);
    card.style.setProperty("--rx", `${rotateX.toFixed(2)}deg`);
    card.style.setProperty("--ry", `${rotateY.toFixed(2)}deg`);
  };

  const handlePointerLeave = () => {
    const card = cardRef.current;
    if (!card) {
      return;
    }

    card.style.setProperty("--rx", "0deg");
    card.style.setProperty("--ry", "0deg");
  };

  return (
    // Gradient border wrapper (1px padding trick)
    <div
      ref={cardRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className="group rounded-xl p-px [transform:perspective(1000px)_rotateX(var(--rx,0deg))_rotateY(var(--ry,0deg))] transition-transform duration-200 ease-out will-change-transform"
      style={{
        ["--mx" as string]: "50%",
        ["--my" as string]: "50%",
        ["--rx" as string]: "0deg",
        ["--ry" as string]: "0deg",
        background:
          "linear-gradient(135deg, color-mix(in srgb, var(--primary) 35%, transparent) 0%, color-mix(in srgb, var(--primary) 10%, transparent) 55%, color-mix(in srgb, var(--border) 60%, transparent) 100%)",
      }}
    >
      {/* Inner — overflow-hidden clips the image to rounded corners */}
      <div className="relative h-56 overflow-hidden rounded-[11px]">
        {/* Background: whale banner image */}
        <Image
          src={`/banner-whale.png?v=${BANNER_VERSION}`}
          alt=""
          fill
          priority
          sizes="(max-width: 672px) 100vw, 672px"
          className="object-cover object-[center_55%] brightness-130 transition-transform duration-500 group-hover:scale-[1.03]"
          aria-hidden="true"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100"
          style={{
            background:
              "radial-gradient(220px circle at var(--mx) var(--my), color-mix(in srgb, white 20%, transparent) 0%, transparent 60%)",
          }}
        />

        {/* Left gradient overlay — ensures text is readable over the image */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.22) 40%, rgba(0,0,0,0.06) 65%, transparent 100%)",
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex h-full flex-col justify-center gap-2.5 px-6 py-5">
          <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1">
            <span className={`h-1.5 w-1.5 rounded-full ${statusColor}`} aria-hidden="true" />
            <span className="font-mono text-[10px] font-medium text-white/70">
              v1.0 — {statusLabel}
              {latencyMs !== null && (
                <span className="ml-1 opacity-60">{latencyMs}ms</span>
              )}
            </span>
          </div>

          <h1 className="text-[2rem] font-bold leading-[1.05] tracking-tight text-white sm:text-[2.3rem]">
            WhaleOps
          </h1>

          <p className="max-w-[200px] text-[11px] font-semibold leading-relaxed text-white/60 sm:max-w-[240px]">
            Monitoreo de infraestructura para containers Docker — Tier 0, solo lectura.
          </p>
        </div>
      </div>
    </div>
  );
}
