import { Section } from "./Section";

function extractYoutubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.endsWith("youtu.be")) return u.pathname.slice(1);
    const parts = u.pathname.split("/").filter(Boolean);
    const liveIdx = parts.indexOf("live");
    if (liveIdx >= 0 && parts[liveIdx + 1]) return parts[liveIdx + 1];
    if (parts.includes("embed") && parts[parts.indexOf("embed") + 1]) {
      return parts[parts.indexOf("embed") + 1];
    }
    const v = u.searchParams.get("v");
    if (v) return v;
    return null;
  } catch {
    return null;
  }
}

export function LiveEmbed({ streamUrl }: { streamUrl: string }) {
  const id = extractYoutubeId(streamUrl);
  return (
    <Section
      id="live"
      eyebrow="Live"
      title="Transmisja 24/7"
      intro="Stream leci nieprzerwanie przez 9 dni. Włącz w tle, zostaw polubienie, udostępnij — zasięg to realna pomoc."
    >
      <div className="vf-card border border-black/5 overflow-hidden bg-black">
        {id ? (
          <div className="relative pb-[56.25%] h-0">
            <iframe
              className="absolute inset-0 h-full w-full"
              src={`https://www.youtube.com/embed/${id}?autoplay=0&modestbranding=1&rel=0`}
              title="Łatwogang — transmisja live"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              loading="lazy"
            />
          </div>
        ) : (
          <div className="aspect-video flex items-center justify-center text-white/60 text-[14px]">
            Link do transmisji nie jest jeszcze skonfigurowany.
          </div>
        )}
      </div>
    </Section>
  );
}
