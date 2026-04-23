import Image from "next/image";
import { Counter } from "./Counter";
import { Countdown } from "./Countdown";

type HeroProps = {
  thumbnailUrl: string;
  streamUrl: string;
  donation: { url: string; label: string } | null;
  counter: { amount: number; source: "ocr" | "manual"; updatedAt: number | null };
  countdownEnd: string | null;
};

export function Hero({
  thumbnailUrl,
  streamUrl,
  donation,
  counter,
  countdownEnd,
}: HeroProps) {
  return (
    <section className="relative isolate overflow-hidden bg-vf-charcoal">
      {/* Documentary bg image + darkening vignette */}
      <div className="absolute inset-0 -z-10">
        <Image
          src={thumbnailUrl}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/60 to-vf-charcoal" />
      </div>

      <div className="max-w-[1440px] mx-auto px-5 md:px-8 pt-32 pb-20 md:pt-44 md:pb-32">
        {/* Eyebrow tag — "LIVE" */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-vf-red text-white text-[11px] font-bold uppercase tracking-[0.14em]">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            Na żywo
          </span>
          <span className="eyebrow text-white/70">
            Łatwogang · Bedoes · Cancer Fighters
          </span>
          {countdownEnd ? <Countdown endsAt={countdownEnd} /> : null}
        </div>

        {/* Monumental display headline */}
        <h1
          className="display text-white max-w-[18ch]"
          style={{
            fontSize: "clamp(3rem, 11vw, 9rem)",
            lineHeight: 0.88,
            letterSpacing: "-0.025em",
          }}
        >
          Dziewięć dni.
          <br />
          <span className="text-vf-red">Jeden cel.</span>
        </h1>

        <p className="mt-8 max-w-2xl text-white/80 text-[18px] md:text-[20px] leading-relaxed">
          Łatwogang przez dziewięć dni non-stop słucha utworu Mai i Bedoesa.
          Każda złotówka trafia do Fundacji Cancer Fighters — 100% bez prowizji.
        </p>

        {/* Counter — huge number, tabular */}
        <div className="mt-12 md:mt-16">
          <p className="eyebrow text-white/60 mb-3">Zebrano dotychczas</p>
          <Counter initial={counter} />
        </div>

        {/* CTA pair */}
        <div className="mt-10 flex flex-wrap items-center gap-4">
          {donation ? (
            <a
              href={donation.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-pill"
            >
              Wpłać — {donation.label}
            </a>
          ) : null}
          <a
            href={streamUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-pill-ghost"
          >
            Oglądaj live
            <svg
              aria-hidden
              className="ml-2"
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
            >
              <path
                d="M5 3l4 4-4 4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        </div>

        <p className="mt-6 text-white/60 text-[13px] flex items-center gap-2">
          <svg
            aria-hidden
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            className="text-vf-red"
          >
            <path
              d="M3 8.5l3 3 7-7"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>
            <strong className="text-white">100% bez prowizji.</strong> Każda złotówka trafia do fundacji.
          </span>
        </p>
      </div>
    </section>
  );
}
