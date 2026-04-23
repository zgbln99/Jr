// Scrapers for public charity fundraiser pages. When the OCR path is
// blocked (YouTube anti-bot, network issues, stream offline), these pull
// the same numbers straight from the source of truth. No auth needed —
// both pages are public and render the amount either in the HTML or in
// a machine-readable JSON island.
//
// Each scraper returns the amount in PLN (float). When the page layout
// changes, the parser logs what it saw so you can iterate quickly.

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "pl,en;q=0.8",
    },
  });
  if (!res.ok) {
    throw new Error(`${url} → HTTP ${res.status}`);
  }
  return res.text();
}

// Parse a single Polish-formatted currency string like "5 851 146,29 zł"
// or "6,123,456.00 PLN" or "6.123.456" into a JS number.
function parseAmount(raw) {
  let s = String(raw).trim().replace(/\s|&nbsp;| /g, "");
  const dec = s.match(/([.,])(\d{1,2})$/);
  if (dec) {
    const head = s.slice(0, s.length - (dec[2].length + 1)).replace(/[.,]/g, "");
    s = head + "." + dec[2];
  } else {
    s = s.replace(/[.,]/g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Find all PLN amounts in a blob of HTML/text. Used as a generic fallback
// when platform-specific parsers can't find their preferred anchors.
function findAllAmounts(html) {
  const found = [];
  const re = /([\d\s., ]{3,}?)\s*(?:zł|pln|PLN|z[ł])/gi;
  let m;
  while ((m = re.exec(html)) != null) {
    const n = parseAmount(m[1]);
    if (n != null) found.push(n);
  }
  return found;
}

// Strip HTML tags — we do all parsing on rendered text so whitespace
// between spans doesn't break number matches.
function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------- Siepomaga ----------------
//
// siepomaga.pl pages embed the current total in several places. We look
// for the one closest to the "Zebrano" label, then fall back to the first
// large "X zł" on the page.
export async function scrapeSiepomaga(url) {
  const html = await fetchHtml(url);
  const text = htmlToText(html);

  // Anchor on "Zebrano" which is the label Siepomaga uses for the running
  // total. Take the first amount in a short window after it.
  const zebranoMatch = text.match(/Zebrano[^0-9]{0,40}([\d\s., ]+?)\s*(?:zł|pln)/i);
  if (zebranoMatch) {
    const n = parseAmount(zebranoMatch[1]);
    if (n != null && n > 0) return { amount: n, hint: "siepomaga/zebrano" };
  }

  // Fallback: grab any JSON-LD offer price or "amountRaised" number.
  const jsonLd = html.match(/"amountRaised"\s*:\s*"?([\d.]+)"?/i)
    || html.match(/"collected"\s*:\s*"?([\d.]+)"?/i);
  if (jsonLd) {
    const n = parseAmount(jsonLd[1]);
    if (n != null && n > 0) return { amount: n, hint: "siepomaga/json" };
  }

  // Last resort: largest PLN amount on the page, excluding very small
  // (<100 zł — probably donation tier hints).
  const all = findAllAmounts(text).filter((n) => n >= 100);
  if (all.length > 0) {
    const max = Math.max(...all);
    return { amount: max, hint: "siepomaga/max" };
  }

  throw new Error("Siepomaga: nie znalazłem kwoty na stronie");
}

// ---------------- Tipply ----------------
//
// Tipply fundraiser pages (@handle) show the total under "Łącznie
// zebrano" or similar phrasing. They also ship a Next.js __NEXT_DATA__
// JSON blob with the number as a cleaner source.
export async function scrapeTipply(url) {
  const html = await fetchHtml(url);

  // __NEXT_DATA__ island — cleanest path when present.
  const nextData = html.match(
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/,
  );
  if (nextData) {
    try {
      const data = JSON.parse(nextData[1]);
      // Walk a few likely paths. Tipply renames these occasionally.
      const hit = findFirstNumber(data, [
        "totalAmount",
        "collectedAmount",
        "amountCollected",
        "total",
        "sum",
        "amount",
      ]);
      if (hit != null && hit > 0) {
        return { amount: hit, hint: "tipply/nextdata" };
      }
    } catch {
      /* fall through to HTML scraping */
    }
  }

  const text = htmlToText(html);

  // Label-anchored match.
  for (const label of ["Łącznie zebrano", "Zebrano", "Suma", "Razem"]) {
    const re = new RegExp(
      label + "[^0-9]{0,40}([\\d\\s.,\\u00A0]+?)\\s*(?:zł|pln)",
      "i",
    );
    const m = text.match(re);
    if (m) {
      const n = parseAmount(m[1]);
      if (n != null && n > 0) return { amount: n, hint: `tipply/${label}` };
    }
  }

  // Fallback: largest PLN amount, skipping tiny tip defaults.
  const all = findAllAmounts(text).filter((n) => n >= 100);
  if (all.length > 0) {
    const max = Math.max(...all);
    return { amount: max, hint: "tipply/max" };
  }

  throw new Error("Tipply: nie znalazłem kwoty na stronie");
}

// Walk an object breadth-first looking for one of the given keys with a
// numeric value. Tipply sometimes has the number as a stringified PLN
// like "5851146.29" — both are OK here.
function findFirstNumber(obj, keys) {
  const queue = [obj];
  const keySet = new Set(keys.map((k) => k.toLowerCase()));
  while (queue.length) {
    const cur = queue.shift();
    if (!cur || typeof cur !== "object") continue;
    for (const [k, v] of Object.entries(cur)) {
      if (keySet.has(k.toLowerCase())) {
        if (typeof v === "number" && Number.isFinite(v)) return v;
        if (typeof v === "string") {
          const n = parseAmount(v);
          if (n != null) return n;
        }
      }
      if (v && typeof v === "object") queue.push(v);
    }
  }
  return null;
}

// ---------------- Dispatcher ----------------

export async function scrapeDonationUrl(url) {
  const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  if (host.includes("siepomaga.pl")) return scrapeSiepomaga(url);
  if (host.includes("tipply.pl")) return scrapeTipply(url);
  throw new Error(`Nieznana platforma: ${host}`);
}
