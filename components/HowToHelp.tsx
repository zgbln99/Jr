import { Section } from "./Section";
import { ShareButtons } from "./ShareButtons";

type Donation = { url: string; label: string };

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://jrjr.pl";

export function HowToHelp({ donations }: { donations: Donation[] }) {
  return (
    <Section
      id="pomoc"
      eyebrow="Jak pomóc"
      title="Trzy minuty, realna pomoc"
      intro="Żaden gest nie jest za mały. Wpłać ile możesz, udostępnij znajomym, włącz stream w tle."
      band
    >
      <div className="grid md:grid-cols-3 gap-6 md:gap-8">
        {/* KROK 1 — Wpłać */}
        <article className="vf-card border border-black/5 p-8 flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <span className="eyebrow text-vf-red">Krok 1</span>
            <span className="tag-outlined">
              <svg
                width="10"
                height="10"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden
                className="mr-1 text-vf-red"
              >
                <path
                  d="M3 8.5l3 3 7-7"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Bez prowizji
            </span>
          </div>
          <h3 className="text-[28px] md:text-[32px] font-bold text-vf-charcoal tracking-tight leading-tight">
            Wpłać
          </h3>
          <p className="text-vf-body text-[16px] leading-relaxed">
            Obie zrzutki <strong className="text-vf-charcoal">nie pobierają prowizji</strong> — 100% Twojej wpłaty trafia do Fundacji Cancer Fighters.
          </p>
          <div className="mt-auto flex flex-col gap-3">
            {donations.length === 0 ? (
              <span className="text-vf-body text-[13px]">Linki wkrótce.</span>
            ) : (
              donations.map((d, i) => (
                <a
                  key={i}
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-rect"
                >
                  {d.label}
                </a>
              ))
            )}
          </div>
        </article>

        {/* KROK 2 — Udostępnij */}
        <article className="vf-card border border-black/5 p-8 flex flex-col gap-5">
          <span className="eyebrow text-vf-red">Krok 2</span>
          <h3 className="text-[28px] md:text-[32px] font-bold text-vf-charcoal tracking-tight leading-tight">
            Udostępnij
          </h3>
          <p className="text-vf-body text-[16px] leading-relaxed">
            Wrzuć na stories, wyślij znajomym, dodaj do bio. Każdy nowy widz to realna pomoc.
          </p>
          <div className="mt-auto">
            <ShareButtons url={SITE_URL} />
          </div>
        </article>

        {/* KROK 3 — Oglądaj */}
        <article className="vf-card border border-black/5 p-8 flex flex-col gap-5">
          <span className="eyebrow text-vf-red">Krok 3</span>
          <h3 className="text-[28px] md:text-[32px] font-bold text-vf-charcoal tracking-tight leading-tight">
            Oglądaj
          </h3>
          <p className="text-vf-body text-[16px] leading-relaxed">
            Włącz stream w tle. Każdy widz to zasięg, który dociera do kolejnych darczyńców.
          </p>
          <div className="mt-auto">
            <a href="#live" className="btn-rect-ghost">
              Do transmisji →
            </a>
          </div>
        </article>
      </div>
    </Section>
  );
}
