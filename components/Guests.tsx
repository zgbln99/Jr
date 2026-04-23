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
    <article className="group rounded-[8px] border border-stripe-border bg-white overflow-hidden shadow-stripe-soft hover:shadow-stripe-elevated transition-shadow">
      <div className="aspect-[4/5] relative bg-gradient-to-br from-stripe-purple-soft to-stripe-magenta-light overflow-hidden">
        {photoUrl ? (
          // Using native img for unknown remote hosts (admin-uploaded)
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt={guest.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-stripe-purple-deep text-[48px] font-light">
            {guest.name.charAt(0)}
          </div>
        )}
        <div className="absolute top-3 left-3">
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] text-[10px] uppercase tracking-wide border ${
              guest.status === "upcoming"
                ? "bg-stripe-magenta-light text-stripe-ruby border-stripe-magenta-light"
                : "bg-white text-stripe-success-text border-stripe-success/40"
            }`}
          >
            {guest.status === "upcoming" ? "Wkrótce" : "Już był"}
          </span>
        </div>
      </div>
      <div className="p-5">
        <h3
          className="text-stripe-navy font-light"
          style={{ fontSize: "1.25rem", letterSpacing: "-0.01em" }}
        >
          {guest.name}
        </h3>
        {guest.handle ? (
          <p className="text-stripe-body text-[13px] mt-0.5">@{guest.handle.replace(/^@/, "")}</p>
        ) : null}
        <div className="mt-3 flex items-center justify-between text-[12px] text-stripe-body tnum">
          <span>{dateLabel ?? ""}</span>
          {instagramHref ? (
            <a
              href={instagramHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-stripe-purple hover:text-stripe-purple-hover"
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
      title="Kto wpadł na stream — i kto jeszcze wpadnie"
      intro="Influencerzy, artyści i zaproszeni goście wspierają akcję — golą głowy, robią tatuaże, licytują przedmioty, rozmawiają z widzami."
    >
      {upcoming.length > 0 ? (
        <div className="mb-12">
          <h3 className="text-stripe-label text-[14px] uppercase tracking-[0.14em] mb-5">
            Wkrótce w programie
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {upcoming.map((g) => (
              <GuestCard key={g.id} guest={g} />
            ))}
          </div>
        </div>
      ) : null}

      {past.length > 0 ? (
        <div>
          <h3 className="text-stripe-label text-[14px] uppercase tracking-[0.14em] mb-5">
            Już na streamie
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {past.map((g) => (
              <GuestCard key={g.id} guest={g} />
            ))}
          </div>
        </div>
      ) : null}

      {guests.length === 0 ? (
        <p className="rounded-[6px] border border-dashed border-stripe-purple-soft bg-white p-8 text-center text-stripe-body">
          Lista gości jest uzupełniana na bieżąco — wróć za chwilę.
        </p>
      ) : null}
    </Section>
  );
}
