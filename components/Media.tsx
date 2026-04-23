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
      className="group vf-card border border-black/5 flex flex-col"
    >
      <div className="aspect-[16/9] relative bg-vf-neutral overflow-hidden">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-[18px] uppercase tracking-wider font-bold text-vf-body text-center px-6">
            {item.outlet}
          </div>
        )}
      </div>
      <div className="p-5 md:p-6 flex-1 flex flex-col">
        <div className="flex items-center gap-2 mb-2">
          <span className="eyebrow text-vf-red">{item.outlet}</span>
          {host && host.toLowerCase() !== item.outlet.toLowerCase() ? (
            <>
              <span className="text-vf-body/50 text-[11px]">·</span>
              <span className="text-vf-body text-[11px] normal-case tracking-normal">
                {host}
              </span>
            </>
          ) : null}
        </div>
        <h3 className="text-[19px] font-bold text-vf-charcoal leading-tight tracking-tight">
          {item.title}
        </h3>
        <div className="mt-auto pt-5 flex items-center justify-between text-[12px] tnum">
          <span className="text-vf-body">{dateLabel ?? ""}</span>
          <span className="text-vf-red font-bold uppercase tracking-wider group-hover:underline">
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
      intro="Redakcje i twórcy, którzy nagłaśniają zbiórkę. Chcesz napisać o akcji? Daj znać."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((item) => (
          <MentionCard key={item.id} item={item} />
        ))}
      </div>
    </Section>
  );
}
