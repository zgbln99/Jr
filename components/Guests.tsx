import { Section } from "./Section";
import type { Guest } from "@/lib/db";
import { normalizePhotoUrl } from "@/lib/media";

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "long",
  }).format(d);
}

function GuestCard({ guest }: { guest: Guest }) {
  const dateLabel = formatDate(guest.appearance_date);
  const photoUrl = normalizePhotoUrl(guest.photo_url);
  const instagramHref = guest.instagram
    ? guest.instagram.startsWith("http")
      ? guest.instagram
      : `https://instagram.com/${guest.instagram.replace(/^@/, "")}`
    : null;

  return (
    <article className="vf-card border border-black/5">
      <div className="aspect-[4/5] relative bg-vf-neutral overflow-hidden">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt={guest.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-vf-body text-[56px] font-bold">
            {guest.name.charAt(0)}
          </div>
        )}
        <div className="absolute top-3 left-3">
          {guest.status === "upcoming" ? (
            <span className="tag-outlined">Wkrótce</span>
          ) : (
            <span className="tag-neutral">Był na streamie</span>
          )}
        </div>
      </div>
      <div className="p-5">
        <h3 className="text-[19px] font-bold text-vf-charcoal tracking-tight">
          {guest.name}
        </h3>
        {guest.handle ? (
          <p className="text-vf-body text-[13px] mt-0.5">
            @{guest.handle.replace(/^@/, "")}
          </p>
        ) : null}
        <div className="mt-4 flex items-center justify-between text-[12px] tnum">
          <span className="text-vf-body uppercase tracking-wider">
            {dateLabel ?? ""}
          </span>
          {instagramHref ? (
            <a
              href={instagramHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-vf-red font-bold uppercase tracking-wider hover:underline"
            >
              Instagram →
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function Guests({ guests }: { guests: Guest[] }) {
  const upcoming = guests.filter((g) => g.status === "upcoming");
  const past = guests.filter((g) => g.status === "past");

  return (
    <Section
      id="goscie"
      eyebrow="Goście"
      title="Kto wpada na stream"
      intro="Influencerzy, artyści, sportowcy. Golą głowy w geście solidarności, licytują, rozmawiają z widzami."
    >
      {upcoming.length > 0 ? (
        <div className="mb-14">
          <p className="eyebrow text-vf-red mb-6">Wkrótce w programie</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 md:gap-6">
            {upcoming.map((g) => (
              <GuestCard key={g.id} guest={g} />
            ))}
          </div>
        </div>
      ) : null}

      {past.length > 0 ? (
        <div>
          <p className="eyebrow text-vf-red mb-6">Już na streamie</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 md:gap-6">
            {past.map((g) => (
              <GuestCard key={g.id} guest={g} />
            ))}
          </div>
        </div>
      ) : null}

      {guests.length === 0 ? (
        <p className="text-vf-body text-[17px] max-w-xl">
          Lista gości będzie uzupełniana na bieżąco. Zajrzyj wieczorem.
        </p>
      ) : null}
    </Section>
  );
}
