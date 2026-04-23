import { Section } from "./Section";

type Initiator = { name: string; role: string; instagram?: string };

export function Initiators({
  text,
  latwogangIg,
  bedoesIg,
}: {
  text: string;
  latwogangIg?: string;
  bedoesIg?: string;
}) {
  const people: Initiator[] = [
    {
      name: "Łatwogang",
      role: "Pomysłodawca i gospodarz 9-dniowego streamu",
      instagram: latwogangIg || undefined,
    },
    {
      name: "Bedoes",
      role: "Współtwórca utworu, który leci na streamie non-stop",
      instagram: bedoesIg || undefined,
    },
  ];

  return (
    <Section
      id="inicjatorzy"
      eyebrow="Inicjatorzy"
      title="Ludzie, którzy to zaczęli"
      intro={text}
    >
      <div className="grid md:grid-cols-2 gap-6">
        {people.map((p) => (
          <article
            key={p.name}
            className="rounded-[8px] border border-stripe-border bg-white p-7 shadow-stripe-elevated hover:-translate-y-0.5 transition-transform"
          >
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-[6px] bg-gradient-to-br from-stripe-purple to-stripe-ruby flex items-center justify-center text-white text-[20px] font-light">
                {p.name.charAt(0)}
              </div>
              <div>
                <h3
                  className="text-stripe-navy font-light"
                  style={{ fontSize: "1.375rem", letterSpacing: "-0.01em" }}
                >
                  {p.name}
                </h3>
                <p className="text-stripe-body text-[14px]">{p.role}</p>
              </div>
            </div>
            {p.instagram ? (
              <a
                href={p.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center text-[14px] text-stripe-purple hover:text-stripe-purple-hover"
              >
                Instagram
                <svg
                  aria-hidden
                  className="ml-1.5"
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                >
                  <path
                    d="M3 9l6-6M5 3h4v4"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
            ) : null}
          </article>
        ))}
      </div>
    </Section>
  );
}
