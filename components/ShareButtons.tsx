"use client";

import { useState } from "react";

export function ShareButtons({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const tweetHref =
    "https://twitter.com/intent/tweet?text=" +
    encodeURIComponent(
      "Łatwogang × Bedoes × Cancer Fighters — 9 dni transmisji na rzecz dzieci chorych na raka. Dołącz:",
    ) +
    "&url=" +
    encodeURIComponent(url);

  async function copy() {
    try {
      if (typeof navigator !== "undefined" && "clipboard" in navigator) {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      /* clipboard blocked — silently no-op */
    }
  }

  return (
    <div className="flex flex-wrap gap-3">
      <a
        href={tweetHref}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-rect-ghost"
      >
        Wrzuć na X
      </a>
      <button type="button" onClick={copy} className="btn-rect-ghost">
        {copied ? "Skopiowane" : "Skopiuj link"}
      </button>
    </div>
  );
}
