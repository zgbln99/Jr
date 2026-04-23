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
    <section className="relative isolate overflow-hidden">
      {/* Background image — YouTube thumbnail, blurred + darkened */}
      <div className="absolute inset-0 -z-10">
        <Image
          src={thumbnailUrl}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover scale-110 blur-[2px]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-stripe-brand-dark/80 via-stripe-brand-dark/85 to-white" />
        <div className="absolute inset-0 bg-hero-glow mix-blend-screen opacity-80" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-white" />
      </div>

      <div className="max-w-[1180px] mx-auto px-6 pt-28 md:pt-36 pb-24 md:pb-40">
        <div className="flex flex-col items-center text-center gap-8">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/15 bg-white/5 backdrop-blur text-white/80 text-[11px] uppercase tracking-[0.14em]">
              <span className="h-1.5 w-1.5 rounded-full bg-stripe-ruby animate-pulse-slow" />
              Live · Łatwogang x Bedoes x Cancer Fighters
            </span>
            {countdownEnd ? <Countdown endsAt={countdownEnd} /> : null}
          </div>

          <h1
            className="text-white font-light max-w-4xl"
            style={{
              fontSize: "clamp(2.25rem, 5.5vw, 3.5rem)",
              lineHeight: 1.05,
              letterSpacing: "-0.035em",
            }}
          >
            Dziewięć dni jednego utworu.
            <br />
            <span className="gradient-text">Jeden cel.</span>
          </h1>

          <p className="max-w-2xl text-white/75 text-[17px] leading-relaxed">
            Łatwogang przez dziewięć dni non-stop słucha na streamie utworu Mai
            i Bedoesa. Każda wpłata wspiera dzieci chore na raka przez Fundację
            Cancer Fighters.
          </p>

          <div className="w-full max-w-3xl mt-2">
            <Counter initial={counter} />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
            {donation ? (
              <a
                href={donation.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center h-11 px-5 rounded-[4px] bg-stripe-purple text-white text-[16px] font-normal hover:bg-stripe-purple-hover transition-colors shadow-stripe-elevated"
              >
                Wpłać teraz · {donation.label}
              </a>
            ) : null}
            <a
              href={streamUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center h-11 px-5 rounded-[4px] border border-white/25 text-white text-[16px] hover:bg-white/5 transition-colors"
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
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
