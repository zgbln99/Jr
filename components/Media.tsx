import { Section } from "./Section";
import type { MediaMention } from "@/lib/db";
import { normalizePhotoUrl } from "@/lib/media";

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);
}

function outletFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function MentionCard({ item }: { item: MediaMention }) {
  const dateLabel = formatDate(item.published_at);
  const image = normalizePhotoUrl(item.image_url);
  const host = outletFromUrl(item.url);

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col rounded-[8px] border border-stripe-border bg-white overflow-hidden shadow-stripe-soft hover:shadow-stripe-elevated transition-shadow"
    >
      <div className="aspect-[16/9] relative bg-gradient-to-br from-stripe-purple-soft to-stripe-magenta-light overflow-hidden">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-stripe-purple-deep text-[15px] uppercase tracking-[0.14em] font-light px-4 text-center">
            {item.outlet}
          </div>
        )}
      </div>
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-stripe-purple">
          <span>{item.outlet}</span>
          {host && host.toLowerCase() !== item.outlet.toLowerCase() ? (
            <>
              <span className="text-stripe-body/50">·</span>
              <span className="text-stripe-body normal-case tracking-normal">{host}</span>
            </>
          ) : null}
        </div>
        <h3
          className="mt-2 text-stripe-navy font-light"
          style={{ fontSize: "1.125rem", lineHeight: 1.3, letterSpacing: "-0.01em" }}
        >
          {item.title}
        </h3>
        <div className="mt-auto pt-4 flex items-center justify-between text-[12px] text-stripe-body tnum">
          <span>{dateLabel ?? ""}</span>
          <span className="text-stripe-purple group-hover:text-stripe-purple-hover">
            Czytaj →
          </span>
        </div>
      </div>
    </a>
  );
}

export function Media({ items }: { items: MediaMention[] }) {
  if (items.length === 0) return null;
  return (
    <Section
      id="media"
      eyebrow="Media o akcji"
      title="Piszą i mówią o nas"
      intro="Redakcje i twórcy, którzy nagłaśniają zbiórkę. Jeśli chcesz napisać o akcji, daj znać."
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {items.map((item) => (
          <MentionCard key={item.id} item={item} />
        ))}
      </div>
    </Section>
  );
}
