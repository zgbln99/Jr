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
      band
    >
      <div className="flex flex-wrap gap-3">
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-pill"
          >
            Strona fundacji
          </a>
        ) : null}
        {instagram ? (
          <a
            href={instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-pill-ghost"
          >
            Instagram fundacji
          </a>
        ) : null}
      </div>
    </Section>
  );
}
