import { Section } from "./Section";

export function About({ text }: { text: string }) {
  return (
    <Section id="o-akcji" eyebrow="O akcji" title="Skąd pomysł na 9 dni" band>
      <div className="grid md:grid-cols-12 gap-8 md:gap-12">
        <div className="md:col-span-7">
          <p className="text-[19px] md:text-[20px] leading-[1.55] text-vf-charcoal whitespace-pre-line">
            {text}
          </p>
        </div>
        <ul className="md:col-span-5 space-y-0 border-t border-black/10">
          {[
            { k: "Jeden utwór", v: "Maja × Bedoes" },
            { k: "Dziewięć dni", v: "216 godzin non-stop" },
            { k: "Jeden cel", v: "Dzieci z nowotworami" },
          ].map((row) => (
            <li
              key={row.k}
              className="flex items-baseline justify-between gap-6 py-5 border-b border-black/10"
            >
              <span className="eyebrow text-vf-red">{row.k}</span>
              <span className="text-[17px] md:text-[19px] text-vf-charcoal font-medium tnum">
                {row.v}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
