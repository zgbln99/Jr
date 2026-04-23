"use client";

import { useState } from "react";

export function ShareButtons({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const tweetHref =
    "https://twitter.com/intent/tweet?text=" +
    encodeURIComponent(
      "Łatwogang x Bedoes x Cancer Fighters — 9 dni transmisji na rzecz dzieci chorych na raka. Dołącz:",
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
    <div className="mt-5 flex flex-wrap gap-2">
      <a
        href={tweetHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center h-9 px-3 rounded-[4px] border border-stripe-purple-light text-stripe-purple text-[13px] hover:bg-stripe-purple/5"
      >
        Wrzuć na X
      </a>
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center h-9 px-3 rounded-[4px] border border-stripe-purple-light text-stripe-purple text-[13px] hover:bg-stripe-purple/5"
      >
        {copied ? "Skopiowane" : "Skopiuj link"}
      </button>
    </div>
  );
}
