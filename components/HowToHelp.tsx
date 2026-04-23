import { Section } from "./Section";

type Donation = { url: string; label: string };

export function HowToHelp({ donations }: { donations: Donation[] }) {
  return (
    <Section
      id="pomoc"
      eyebrow="Jak pomóc"
      title="Trzy minuty, realna pomoc"
      intro="Żaden gest nie jest za mały. Wpłać tyle ile możesz, udostępnij akcję znajomym, włącz stream w tle."
    >
      <div className="grid md:grid-cols-3 gap-5">
        <article className="rounded-[8px] border border-stripe-border bg-white p-7 shadow-stripe-soft">
          <div className="flex items-center gap-2">
            <p className="text-[11px] uppercase tracking-[0.14em] text-stripe-purple">
              Krok 1
            </p>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] bg-stripe-success/15 text-stripe-success-text text-[10px] uppercase tracking-wide border border-stripe-success/30">
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Bez prowizji
            </span>
          </div>
          <h3 className="mt-2 text-stripe-navy font-light text-[22px]">Wpłać</h3>
          <p className="mt-3 text-stripe-body text-[15px] leading-relaxed">
            Obie zrzutki nie pobierają ani złotówki prowizji — <strong>100% Twojej wpłaty</strong> trafia do
            Fundacji Cancer Fighters.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            {donations.length === 0 ? (
              <span className="text-[13px] text-stripe-body">
                Linki zostaną wkrótce dodane.
              </span>
            ) : (
              donations.map((d, i) => (
                <a
                  key={i}
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center h-10 px-4 rounded-[4px] bg-stripe-purple text-white text-[14px] hover:bg-stripe-purple-hover transition-colors"
                >
                  {d.label}
                </a>
              ))
            )}
          </div>
        </article>

        <article className="rounded-[8px] border border-stripe-border bg-white p-7 shadow-stripe-soft">
          <p className="text-[11px] uppercase tracking-[0.14em] text-stripe-purple">
            Krok 2
          </p>
          <h3 className="mt-2 text-stripe-navy font-light text-[22px]">Udostępnij</h3>
          <p className="mt-3 text-stripe-body text-[15px] leading-relaxed">
            Wrzuć na stories, wyślij znajomym, dodaj do bio. Każdy nowy widz to
            realna pomoc.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                "Łatwogang x Bedoes x Cancer Fighters — 9 dni transmisji na rzecz dzieci chorych na raka. Dołącz:",
              )}&url=${encodeURIComponent("https://jrjr.pl")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center h-9 px-3 rounded-[4px] border border-stripe-purple-light text-stripe-purple text-[13px] hover:bg-stripe-purple/5"
            >
              Wrzuć na X
            </a>
            <a
              href="https://jrjr.pl"
              onClick={(e) => {
                e.preventDefault();
                if (typeof navigator !== "undefined" && "clipboard" in navigator) {
                  navigator.clipboard.writeText("https://jrjr.pl");
                }
              }}
              className="inline-flex items-center h-9 px-3 rounded-[4px] border border-stripe-purple-light text-stripe-purple text-[13px] hover:bg-stripe-purple/5"
            >
              Skopiuj link
            </a>
          </div>
        </article>

        <article className="rounded-[8px] border border-stripe-border bg-white p-7 shadow-stripe-soft">
          <p className="text-[11px] uppercase tracking-[0.14em] text-stripe-purple">
            Krok 3
          </p>
          <h3 className="mt-2 text-stripe-navy font-light text-[22px]">Oglądaj</h3>
          <p className="mt-3 text-stripe-body text-[15px] leading-relaxed">
            Włącz stream w tle. Każdy widz to zasięg, który dociera do kolejnych
            darczyńców.
          </p>
          <a
            href="#live"
            className="mt-5 inline-flex items-center h-10 px-4 rounded-[4px] border border-stripe-purple-light text-stripe-purple text-[14px] hover:bg-stripe-purple/5 transition-colors"
          >
            Do transmisji
          </a>
        </article>
      </div>
    </Section>
  );
}
