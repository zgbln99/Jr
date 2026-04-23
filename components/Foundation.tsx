import { Section } from "./Section";

export function Foundation({
  text,
  url,
  instagram,
}: {
  text: string;
  url?: string;
  instagram?: string;
}) {
  return (
    <Section
      id="fundacja"
      eyebrow="Fundacja Cancer Fighters"
      title="Dokąd trafiają pieniądze"
      intro={text}
      dark
    >
      <div className="flex flex-wrap gap-3">
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center h-10 px-4 rounded-[4px] bg-white text-stripe-navy text-[14px] hover:bg-stripe-border transition-colors"
          >
            Strona fundacji
          </a>
        ) : null}
        {instagram ? (
          <a
            href={instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center h-10 px-4 rounded-[4px] border border-white/20 text-white text-[14px] hover:bg-white/5 transition-colors"
          >
            Instagram fundacji
          </a>
        ) : null}
      </div>
    </Section>
  );
}
