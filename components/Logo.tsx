"use client";

import { useState } from "react";

type LogoProps = {
  size?: number;
  showText?: boolean;
  textClassName?: string;
};

// Renders /logo.png if it exists in /public, otherwise falls back to the
// inline red-speech-mark. Drop a logo.png (or logo.svg) into /public/ and
// the site picks it up automatically — no code change needed.
export function Logo({ size = 36, showText = true, textClassName = "" }: LogoProps) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <span className="inline-flex items-center gap-3">
      {imgFailed ? (
        <span
          className="relative inline-block rounded-full bg-vf-red shrink-0"
          style={{ width: size, height: size }}
          aria-hidden
        >
          <span
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
            style={{ width: size * 0.35, height: size * 0.35 }}
          />
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/logo.png"
          alt="jrjr.pl"
          width={size}
          height={size}
          onError={() => setImgFailed(true)}
          className="block shrink-0 object-contain"
          style={{ width: size, height: size }}
        />
      )}
      {showText ? (
        <span className={textClassName}>jrjr.pl</span>
      ) : null}
    </span>
  );
}
