import type { ReactNode } from "react";

type SectionProps = {
  id?: string;
  eyebrow?: string;
  title: string;
  intro?: string;
  dark?: boolean;
  children?: ReactNode;
};

export function Section({ id, eyebrow, title, intro, dark, children }: SectionProps) {
  return (
    <section
      id={id}
      className={dark ? "bg-stripe-brand-dark text-white" : "bg-white"}
    >
      <div className="max-w-[1180px] mx-auto px-6 py-20 md:py-28">
        {eyebrow ? (
          <p
            className={`text-[12px] uppercase tracking-[0.16em] mb-4 ${
              dark ? "text-white/60" : "text-stripe-purple"
            }`}
          >
            {eyebrow}
          </p>
        ) : null}
        <h2
          className={`font-light max-w-3xl ${
            dark ? "text-white" : "text-stripe-navy"
          }`}
          style={{
            fontSize: "clamp(1.75rem, 3.6vw, 2rem)",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
          }}
        >
          {title}
        </h2>
        {intro ? (
          <p
            className={`mt-5 max-w-2xl text-[17px] leading-relaxed ${
              dark ? "text-white/75" : "text-stripe-body"
            }`}
          >
            {intro}
          </p>
        ) : null}
        {children ? <div className="mt-10 md:mt-14">{children}</div> : null}
      </div>
    </section>
  );
}
