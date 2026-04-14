"use client";

import Image from "next/image";
import Link from "next/link";

export function WhaleLogo() {
  return (
    <Link
      href="/"
      aria-label="WhaleOps — inicio"
      className="block rounded-lg p-0.5 transition-transform duration-200 ease-out hover:-translate-y-0.5 hover:rotate-3 active:scale-90 active:rotate-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
    >
      <Image
        src="/logo-whale.png"
        alt="WhaleOps"
        width={48}
        height={48}
        priority
        className="h-auto w-9 sm:w-10 md:w-11"
      />
    </Link>
  );
}
