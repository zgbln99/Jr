import type { ReactNode } from "react";

type SectionProps = {
  id?: string;
  eyebrow?: string;
  title: string;
  intro?: string;
  dark?: boolean;
  band?: boolean;
  children?: ReactNode;
};

export function Section({
  id,
  eyebrow,
  title,
  intro,
  dark,
  band,
  children,
}: SectionProps) {
  return (
    <>
      {band ? <div className="red-band" aria-hidden /> : null}
      <section
        id={id}
        className={dark ? "bg-vf-charcoal text-white" : "bg-white text-vf-charcoal"}
      >
        <div className="max-w-[1440px] mx-auto px-5 md:px-8 py-20 md:py-28">
          {eyebrow ? (
            <p
              className={`eyebrow mb-5 ${
                dark ? "text-white/60" : "text-vf-red"
              }`}
            >
              {eyebrow}
            </p>
          ) : null}
          <h2
            className="display max-w-[16ch]"
            style={{
              fontSize: "clamp(2.25rem, 6vw, 4.25rem)",
              lineHeight: 0.95,
              letterSpacing: "-0.025em",
            }}
          >
            {title}
          </h2>
          {intro ? (
            <p
              className={`mt-6 max-w-2xl text-[18px] leading-relaxed ${
                dark ? "text-white/75" : "text-vf-body"
              }`}
            >
              {intro}
            </p>
          ) : null}
          {children ? <div className="mt-12 md:mt-16">{children}</div> : null}
        </div>
      </section>
    </>
  );
}

// Red chapter-break band on its own (for use between sections when Section's
// built-in `band` prop isn't enough).
export function RedBand() {
  return <div className="red-band" aria-hidden />;
}
