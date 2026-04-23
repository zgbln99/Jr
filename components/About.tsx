import { Section } from "./Section";

export function About({ text }: { text: string }) {
  return (
    <Section id="o-akcji" eyebrow="O akcji" title="Skąd pomysł na 9 dni?">
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <p className="text-[17px] leading-relaxed text-stripe-body whitespace-pre-line">
            {text}
          </p>
        </div>
        <ul className="space-y-3">
          <li className="rounded-[6px] border border-stripe-border p-5 bg-white shadow-stripe-soft">
            <p className="text-[11px] uppercase tracking-[0.14em] text-stripe-purple">
              Jeden utwór
            </p>
            <p className="mt-2 text-stripe-navy text-[18px]">Maja × Bedoes</p>
          </li>
          <li className="rounded-[6px] border border-stripe-border p-5 bg-white shadow-stripe-soft">
            <p className="text-[11px] uppercase tracking-[0.14em] text-stripe-purple">
              Dziewięć dni
            </p>
            <p className="mt-2 text-stripe-navy text-[18px] tnum">216 godzin non-stop</p>
          </li>
          <li className="rounded-[6px] border border-stripe-border p-5 bg-white shadow-stripe-soft">
            <p className="text-[11px] uppercase tracking-[0.14em] text-stripe-purple">
              Jeden cel
            </p>
            <p className="mt-2 text-stripe-navy text-[18px]">Dzieci z nowotworami</p>
          </li>
        </ul>
      </div>
    </Section>
  );
}
