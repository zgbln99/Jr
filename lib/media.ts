// Normalize image URLs so admin can paste whatever they get from file hosts
// (Dropbox share page, Google Drive "view" link) and the browser still loads
// them as raw images.

export function normalizePhotoUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Dropbox: any "dropbox.com/..." share link → force raw=1 download.
  // Accepts legacy `/s/` links and new `/scl/fi/` links, with or without
  // `?dl=0` / `?dl=1` / `?raw=0`.
  if (/(^|\/\/)(www\.)?dropbox\.com\//i.test(trimmed)) {
    try {
      const u = new URL(trimmed);
      u.searchParams.delete("dl");
      u.searchParams.delete("raw");
      u.searchParams.set("raw", "1");
      return u.toString();
    } catch {
      return trimmed;
    }
  }

  // dl.dropboxusercontent.com — already raw, pass through.
  // Google Drive "open?id=" / "file/d/ID/view" → uc?export=view&id=ID
  const gdMatch =
    trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i) ||
    trimmed.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/i);
  if (gdMatch) {
    return `https://drive.google.com/uc?export=view&id=${gdMatch[1]}`;
  }

  return trimmed;
}
