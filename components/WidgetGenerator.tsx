"use client";

import { useMemo, useState } from "react";

type Bg = "transparent" | "dark" | "chroma";
type TextColor = "white" | "charcoal" | "red";
type Accent = "red" | "white" | "none";
type Shadow = "strong" | "soft" | "none";
type Backdrop = "dark" | "black" | "light" | "chroma";

const DEFAULTS = {
  bg: "transparent" as Bg,
  text: "white" as TextColor,
  accent: "red" as Accent,
  shadow: "strong" as Shadow,
  scale: 1,
  label: true,
};

const BACKDROPS: Record<Backdrop, { label: string; css: string }> = {
  dark: { label: "Ciemne (jak domyślny stream)", css: "#1a1c1e" },
  black: { label: "Czarne", css: "#000000" },
  light: { label: "Jasne", css: "#f2f2f2" },
  chroma: { label: "Zielone (chroma-key)", css: "#00ff00" },
};

export function WidgetGenerator({ origin }: { origin: string }) {
  const [bg, setBg] = useState<Bg>(DEFAULTS.bg);
  const [text, setText] = useState<TextColor>(DEFAULTS.text);
  const [accent, setAccent] = useState<Accent>(DEFAULTS.accent);
  const [shadow, setShadow] = useState<Shadow>(DEFAULTS.shadow);
  const [scale, setScale] = useState<number>(DEFAULTS.scale);
  const [label, setLabel] = useState<boolean>(DEFAULTS.label);
  const [backdrop, setBackdrop] = useState<Backdrop>("dark");
  const [copied, setCopied] = useState(false);

  const { path, url } = useMemo(() => {
    const p = new URLSearchParams();
    if (bg !== DEFAULTS.bg) p.set("bg", bg);
    if (text !== DEFAULTS.text) p.set("text", text);
    if (accent !== DEFAULTS.accent) p.set("accent", accent);
    if (shadow !== DEFAULTS.shadow) p.set("shadow", shadow);
    if (scale !== DEFAULTS.scale) p.set("scale", String(scale));
    if (label !== DEFAULTS.label) p.set("label", label ? "1" : "0");
    const qs = p.toString();
    const path = qs ? `/widget?${qs}` : "/widget";
    return { path, url: `${origin}${path}` };
  }, [bg, text, accent, shadow, scale, label, origin]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — user can still select manually */
    }
  }

  function reset() {
    setBg(DEFAULTS.bg);
    setText(DEFAULTS.text);
    setAccent(DEFAULTS.accent);
    setShadow(DEFAULTS.shadow);
    setScale(DEFAULTS.scale);
    setLabel(DEFAULTS.label);
  }

  return (
    <div className="min-h-screen bg-white text-vf-charcoal">
      <div className="max-w-[1440px] mx-auto px-5 md:px-8 py-10 md:py-16">
        {/* Header */}
        <div className="mb-10 md:mb-14">
          <a
            href="/"
            className="eyebrow text-vf-body hover:text-vf-red inline-flex items-center gap-2 mb-4"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
              <path
                d="M9 3L5 7l4 4"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Licznik
          </a>
          <h1
            className="display"
            style={{
              fontSize: "clamp(2.5rem, 6vw, 4.25rem)",
              lineHeight: 0.95,
              letterSpacing: "-0.025em",
            }}
          >
            Generator widgetu
          </h1>
          <p className="mt-5 max-w-2xl text-[17px] md:text-[18px] text-vf-body leading-relaxed">
            Ustaw wygląd, zobacz podgląd na żywo, skopiuj URL i wklej w OBS jako
            Browser Source. Domyślny rozmiar źródła w OBS: 1920&nbsp;×&nbsp;300 —
            widget sam dopasuje czcionkę.
          </p>
        </div>

        <div className="grid lg:grid-cols-[360px_1fr] gap-8 md:gap-12">
          {/* --- Controls --- */}
          <div className="space-y-8">
            <ControlGroup title="Tło">
              <Radio
                name="bg"
                value={bg}
                onChange={setBg}
                options={[
                  { v: "transparent", label: "Przezroczyste", hint: "dla OBS" },
                  { v: "dark", label: "Ciemne" },
                  { v: "chroma", label: "Zielone (chroma)" },
                ]}
              />
            </ControlGroup>

            <ControlGroup title="Kolor cyfry">
              <Radio
                name="text"
                value={text}
                onChange={setText}
                options={[
                  { v: "white", label: "Biały" },
                  { v: "charcoal", label: "Ciemny" },
                  { v: "red", label: "Czerwony" },
                ]}
              />
            </ControlGroup>

            <ControlGroup title={'Akcent „zł"'}>
              <Radio
                name="accent"
                value={accent}
                onChange={setAccent}
                options={[
                  { v: "red", label: "Czerwony" },
                  { v: "white", label: "Biały (jak cyfra)" },
                  { v: "none", label: "Taki sam jak cyfra" },
                ]}
              />
            </ControlGroup>

            <ControlGroup title="Cień">
              <Radio
                name="shadow"
                value={shadow}
                onChange={setShadow}
                options={[
                  { v: "strong", label: "Mocny", hint: "domyślny" },
                  { v: "soft", label: "Delikatny" },
                  { v: "none", label: "Brak" },
                ]}
              />
            </ControlGroup>

            <ControlGroup
              title={`Skala: ${scale.toFixed(2)}×`}
              hint="Pomaga gdy OBS auto-dopasowuje rozmiar. Zazwyczaj zostaw 1.00×."
            >
              <input
                type="range"
                min={0.4}
                max={2.5}
                step={0.05}
                value={scale}
                onChange={(e) => setScale(Number(e.target.value))}
                className="w-full accent-vf-red"
              />
              <div className="mt-2 flex items-center justify-between text-[12px] text-vf-body tnum">
                <span>0.40×</span>
                <button
                  type="button"
                  onClick={() => setScale(1)}
                  className="text-vf-red hover:underline"
                >
                  reset 1.00×
                </button>
                <span>2.50×</span>
              </div>
            </ControlGroup>

            <ControlGroup title={'Etykieta „Zebrano dotychczas"'}>
              <label className="inline-flex items-center gap-3 cursor-pointer">
                <span
                  role="switch"
                  aria-checked={label}
                  className={`relative inline-block w-12 h-7 rounded-full transition-colors ${
                    label ? "bg-vf-red" : "bg-vf-disabled"
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 h-5 w-5 bg-white rounded-full shadow transition-transform ${
                      label ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </span>
                <input
                  type="checkbox"
                  checked={label}
                  onChange={(e) => setLabel(e.target.checked)}
                  className="sr-only"
                />
                <span className="text-[14px]">
                  {label ? "Pokaż (domyślnie)" : "Ukryj"}
                </span>
              </label>
            </ControlGroup>

            <div>
              <button
                type="button"
                onClick={reset}
                className="btn-rect-ghost"
              >
                Przywróć domyślne
              </button>
            </div>
          </div>

          {/* --- Preview + URL --- */}
          <div className="space-y-6">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <p className="eyebrow text-vf-red">Podgląd</p>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-vf-body uppercase tracking-wider">
                    Tło podglądu:
                  </span>
                  <select
                    value={backdrop}
                    onChange={(e) => setBackdrop(e.target.value as Backdrop)}
                    className="h-9 px-2 rounded-[2px] border border-vf-form/40 bg-white text-[13px]"
                  >
                    {(Object.entries(BACKDROPS) as Array<[Backdrop, { label: string }]>).map(
                      ([k, v]) => (
                        <option key={k} value={k}>
                          {v.label}
                        </option>
                      ),
                    )}
                  </select>
                </div>
              </div>

              <div
                className="relative w-full aspect-[16/5] rounded-[6px] overflow-hidden border border-black/10"
                style={{ background: BACKDROPS[backdrop].css }}
              >
                <iframe
                  key={path /* reload when params change */}
                  src={path}
                  title="Podgląd widgetu"
                  className="absolute inset-0 h-full w-full"
                  style={{
                    background:
                      bg === "transparent" ? "transparent" : undefined,
                  }}
                />
              </div>

              <p className="mt-3 text-[12px] text-vf-body">
                Podgląd odświeża się za każdym razem gdy zmienisz ustawienie.
                W OBS licznik pulluje co 10 sekund i reaguje animacją tylko na
                wzrost.
              </p>
            </div>

            <div>
              <p className="eyebrow text-vf-red mb-3">URL do OBS</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <code className="flex-1 block px-4 py-3 rounded-[2px] border border-vf-form/40 bg-vf-neutral font-mono text-[13px] break-all">
                  {url}
                </code>
                <button
                  type="button"
                  onClick={copy}
                  className="btn-rect whitespace-nowrap"
                >
                  {copied ? "Skopiowane ✓" : "Skopiuj URL"}
                </button>
              </div>
              <p className="mt-3 text-[12px] text-vf-body">
                Otwórz też bezpośrednio w nowej karcie (same ustawienia):{" "}
                <a
                  href={path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="vf-link"
                >
                  {path} ↗
                </a>
              </p>
            </div>

            <div className="mt-4 rounded-[6px] border border-black/10 p-6 bg-vf-neutral/50">
              <p className="eyebrow text-vf-charcoal mb-3">Jak wkleić w OBS</p>
              <ol className="list-decimal list-inside space-y-2 text-[14px] text-vf-charcoal/90">
                <li>
                  Dodaj źródło →{" "}
                  <strong className="font-bold">Browser Source</strong>{" "}
                  (Źródło przeglądarki).
                </li>
                <li>
                  Wklej URL powyżej jako{" "}
                  <strong className="font-bold">URL</strong>.
                </li>
                <li>
                  Ustaw wymiary, np.{" "}
                  <strong className="font-bold">1920 × 300</strong>. Widget sam
                  dopasuje czcionkę.
                </li>
                <li>
                  <strong className="font-bold">Nie zaznaczaj</strong>{" "}
                  „Shutdown source when not visible" — chcemy żeby pollował
                  non-stop.
                </li>
                <li>
                  Możesz w OBS wrzucić dodatkowe Custom CSS, np.{" "}
                  <code className="font-mono bg-white px-1 rounded">
                    body {"{"} transform: scale(1.1); {"}"}
                  </code>
                  jeśli chcesz więcej kontroli.
                </li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ControlGroup({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="eyebrow text-vf-red mb-3">{title}</p>
      {children}
      {hint ? <p className="mt-2 text-[12px] text-vf-body">{hint}</p> : null}
    </div>
  );
}

function Radio<T extends string>({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: T;
  onChange: (v: T) => void;
  options: { v: T; label: string; hint?: string }[];
}) {
  return (
    <div className="flex flex-col gap-2">
      {options.map((o) => (
        <label
          key={o.v}
          className={`flex items-center gap-3 px-4 py-3 rounded-[2px] border cursor-pointer transition-colors ${
            value === o.v
              ? "border-vf-red bg-vf-red/5"
              : "border-vf-form/20 hover:border-vf-form/50"
          }`}
        >
          <input
            type="radio"
            name={name}
            value={o.v}
            checked={value === o.v}
            onChange={() => onChange(o.v)}
            className="sr-only"
          />
          <span
            className={`inline-block h-4 w-4 rounded-full border-2 ${
              value === o.v ? "border-vf-red bg-vf-red" : "border-vf-form/40"
            }`}
            aria-hidden
          >
            {value === o.v ? (
              <span className="block h-full w-full rounded-full bg-vf-red ring-2 ring-white ring-inset" />
            ) : null}
          </span>
          <span className="flex-1">
            <span className="font-medium text-[14px]">{o.label}</span>
            {o.hint ? (
              <span className="text-[12px] text-vf-body ml-2">· {o.hint}</span>
            ) : null}
          </span>
        </label>
      ))}
    </div>
  );
}
