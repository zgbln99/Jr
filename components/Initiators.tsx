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
      role: "Pomysłodawca 9-dniowej transmisji",
      instagram: latwogangIg || undefined,
    },
    {
      name: "Bedoes",
      role: "Współtwórca utworu, który leci non-stop",
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
      <div className="grid md:grid-cols-2 gap-6 md:gap-8">
        {people.map((p) => (
          <article
            key={p.name}
            className="vf-card border border-black/5 p-8 md:p-10 flex flex-col gap-6"
          >
            <div className="flex items-center gap-5">
              <div className="h-16 w-16 rounded-full bg-vf-red text-white flex items-center justify-center text-[24px] font-bold">
                {p.name.charAt(0)}
              </div>
              <div>
                <h3 className="text-[26px] md:text-[28px] font-bold tracking-tight text-vf-charcoal">
                  {p.name}
                </h3>
                <p className="text-vf-body text-[15px] mt-1">{p.role}</p>
              </div>
            </div>
            {p.instagram ? (
              <a
                href={p.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center h-10 px-4 rounded-[2px] border border-vf-form text-vf-form text-[13px] font-bold uppercase tracking-wider self-start hover:bg-vf-neutral transition-colors"
              >
                Instagram
                <svg
                  aria-hidden
                  className="ml-2"
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                >
                  <path
                    d="M3 9l6-6M5 3h4v4"
                    stroke="currentColor"
                    strokeWidth="1.6"
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
