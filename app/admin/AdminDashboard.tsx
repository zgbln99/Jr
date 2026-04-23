"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CounterReading, OcrRegion, PageView, StatsBucket } from "@/lib/db";
import { formatWarsawLabel } from "@/lib/time";
import { OcrCalibration } from "@/components/OcrCalibration";

type Stats = {
  today: StatsBucket;
  week: StatsBucket;
  allTime: StatsBucket;
  byPath: Array<{ path: string; views: number; uniques: number }>;
  referrers: Array<{ referrer: string; views: number }>;
  timeline: Array<{ hourBucket: number; views: number; uniques: number }>;
  recent: PageView[];
};

type Props = {
  settings: Record<string, string>;
  regions: OcrRegion[];
  latest: CounterReading | null;
  latestOcr: CounterReading | null;
  stats: Stats;
};

function formatPLN(n: number): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDateTime(ts: number | null | undefined): string {
  if (!ts) return "—";
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(ts));
}

export function AdminDashboard({ settings, regions, latest, latestOcr, stats }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"counter" | "links" | "ocr" | "stats">("counter");

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <header className="bg-white border-b border-black/5">
        <div className="max-w-[1180px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="relative inline-block h-6 w-6 rounded-full bg-vf-red">
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-white" />
            </span>
            <span className="text-vf-charcoal text-[14px] font-bold uppercase tracking-wider">
              jrjr.pl · admin
            </span>
          </div>
          <div className="flex items-center gap-3">
            <a href="/" className="text-[13px] text-vf-body hover:text-vf-red">
              Strona
            </a>
            <a href="/widget" target="_blank" className="text-[13px] text-vf-body hover:text-vf-red">
              Widget ↗
            </a>
            <button
              onClick={logout}
              className="text-[13px] text-vf-body hover:text-vf-red"
            >
              Wyloguj
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-[1180px] mx-auto px-6 py-10">
        <h1 className="display text-vf-charcoal mb-2" style={{ fontSize: "2.25rem" }}>
          Panel
        </h1>
        <p className="text-vf-body text-[14px] mb-8">
          Ręczna kontrola nad licznikiem, linkami do wpłat i kalibracją OCR.
        </p>

        <div className="flex gap-1 mb-8 border-b border-black/10 overflow-x-auto">
          {(
            [
              ["counter", "Licznik"],
              ["ocr", "Kalibracja OCR"],
              ["links", "Linki i countdown"],
              ["stats", "Statystyki"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 text-[14px] -mb-px border-b-2 ${
                tab === key
                  ? "border-vf-red text-vf-charcoal"
                  : "border-transparent text-vf-body hover:text-vf-charcoal"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "counter" ? (
          <CounterTab latest={latest} latestOcr={latestOcr} />
        ) : null}
        {tab === "links" ? <LinksTab settings={settings} /> : null}
        {tab === "ocr" ? <OcrCalibration initial={regions} /> : null}
        {tab === "stats" ? <StatsTab stats={stats} /> : null}
      </div>
    </div>
  );
}

// ---------------- Stats tab ----------------

function StatsTab({ stats }: { stats: Stats }) {
  const { today, week, allTime, byPath, referrers, timeline, recent } = stats;

  // Fill in hours with zero buckets so the timeline bar chart shows a
  // continuous last-24h strip instead of gaps.
  const nowHour = Math.floor(Date.now() / 3600_000);
  const filledTimeline: { hourBucket: number; views: number; uniques: number }[] = [];
  const timelineMap = new Map(timeline.map((r) => [r.hourBucket, r]));
  for (let h = nowHour - 23; h <= nowHour; h++) {
    filledTimeline.push(
      timelineMap.get(h) ?? { hourBucket: h, views: 0, uniques: 0 },
    );
  }
  const maxViews = Math.max(1, ...filledTimeline.map((b) => b.views));

  const maxPathViews = Math.max(1, ...byPath.map((p) => p.views));
  const maxRefViews = Math.max(1, ...referrers.map((r) => r.views));

  return (
    <>
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <Kpi title="Dziś" bucket={today} />
        <Kpi title="Ostatnie 7 dni" bucket={week} />
        <Kpi title="Wszystko" bucket={allTime} />
      </div>

      <Card title="Ostatnie 24 godziny" description="Wyświetlenia / unikalni odwiedzający na godzinę.">
        <div className="flex items-end gap-[2px] h-40">
          {filledTimeline.map((b) => {
            const h = (b.views / maxViews) * 100;
            const d = new Date(b.hourBucket * 3600_000);
            return (
              <div
                key={b.hourBucket}
                className="flex-1 bg-vf-red/80 hover:bg-vf-red relative group"
                style={{ height: `${Math.max(h, 2)}%` }}
                title={`${d.getHours()}:00 · ${b.views} wyśw. · ${b.uniques} uniques`}
              />
            );
          })}
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-vf-body tnum">
          <span>{formatHour(filledTimeline[0].hourBucket)}</span>
          <span>{formatHour(filledTimeline[filledTimeline.length - 1].hourBucket)}</span>
        </div>
      </Card>

      <Card
        title="Strony (ostatnie 7 dni)"
        description="Który URL dostał najwięcej ruchu. Widget OBS-owy pollowany co 10 s mocno dominuje — nie sugeruj się tą liczbą jako 'widzowie'."
      >
        {byPath.length === 0 ? (
          <p className="text-vf-body text-[13px]">Brak danych.</p>
        ) : (
          <ul className="space-y-2">
            {byPath.map((row) => (
              <li key={row.path}>
                <div className="flex items-baseline justify-between gap-4 mb-1 text-[13px]">
                  <code className="font-mono text-vf-charcoal truncate">{row.path}</code>
                  <span className="tnum text-vf-body">
                    {row.views.toLocaleString("pl-PL")} wyśw. ·{" "}
                    <strong className="text-vf-charcoal">
                      {row.uniques.toLocaleString("pl-PL")}
                    </strong>{" "}
                    uniques
                  </span>
                </div>
                <div className="h-2 rounded-[2px] bg-vf-neutral overflow-hidden">
                  <div
                    className="h-full bg-vf-red"
                    style={{ width: `${(row.views / maxPathViews) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Skąd wchodzą (ostatnie 7 dni)">
        {referrers.length === 0 ? (
          <p className="text-vf-body text-[13px]">Brak danych.</p>
        ) : (
          <ul className="space-y-2">
            {referrers.map((row) => (
              <li key={row.referrer}>
                <div className="flex items-baseline justify-between gap-4 mb-1 text-[13px]">
                  <span className="truncate text-vf-charcoal">{row.referrer}</span>
                  <span className="tnum text-vf-body">
                    {row.views.toLocaleString("pl-PL")} wyśw.
                  </span>
                </div>
                <div className="h-2 rounded-[2px] bg-vf-neutral overflow-hidden">
                  <div
                    className="h-full bg-vf-red/70"
                    style={{ width: `${(row.views / maxRefViews) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Ostatnie odwiedziny">
        {recent.length === 0 ? (
          <p className="text-vf-body text-[13px]">Brak.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-vf-form border-b border-black/10">
                  <th className="py-2 pr-3 font-bold uppercase tracking-wider">Kiedy</th>
                  <th className="py-2 pr-3 font-bold uppercase tracking-wider">Ścieżka</th>
                  <th className="py-2 pr-3 font-bold uppercase tracking-wider">Skąd</th>
                  <th className="py-2 pr-3 font-bold uppercase tracking-wider">Urządzenie</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id} className="border-b border-black/5">
                    <td className="py-2 pr-3 tnum text-vf-body whitespace-nowrap">
                      {formatRelative(r.ts)}
                    </td>
                    <td className="py-2 pr-3 font-mono text-vf-charcoal truncate max-w-[200px]">
                      {r.path}
                    </td>
                    <td className="py-2 pr-3 text-vf-body truncate max-w-[240px]">
                      {r.referrer || "—"}
                    </td>
                    <td className="py-2 pr-3 text-vf-body truncate max-w-[260px]">
                      {shortUA(r.user_agent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

function Kpi({ title, bucket }: { title: string; bucket: StatsBucket }) {
  return (
    <div className="bg-white rounded-[6px] border border-black/5 p-5">
      <p className="eyebrow text-vf-red">{title}</p>
      <p className="mt-2 tnum text-vf-charcoal text-[36px] font-bold leading-none">
        {bucket.total.toLocaleString("pl-PL")}
      </p>
      <p className="mt-1 text-[12px] text-vf-body">
        <span className="tnum">{bucket.uniques.toLocaleString("pl-PL")}</span>{" "}
        unikalnych
      </p>
    </div>
  );
}

function formatHour(hourBucket: number): string {
  const d = new Date(hourBucket * 3600_000);
  return d.toLocaleTimeString("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatRelative(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s} s temu`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min temu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} godz. temu`;
  const d = Math.floor(h / 24);
  return `${d} dni temu`;
}

function shortUA(ua: string | null): string {
  if (!ua) return "—";
  // Grab the distinctive engine / app part so the table isn't full of
  // full 200-char user-agent strings.
  const m =
    ua.match(/OBS\/[\d.]+/) ||
    ua.match(/Edg\/[\d.]+/) ||
    ua.match(/Chrome\/[\d.]+/) ||
    ua.match(/Firefox\/[\d.]+/) ||
    ua.match(/Safari\/[\d.]+/);
  const engine = m ? m[0] : ua.slice(0, 40);
  const mobile = /Mobile|Android|iPhone/.test(ua) ? " · mobile" : "";
  return engine + mobile;
}

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-[6px] border border-black/5 p-6 mb-6">
      <h2 className="text-vf-charcoal font-bold text-[22px] tracking-tight">
        {title}
      </h2>
      {description ? (
        <p className="text-vf-body text-[14px] mt-1 mb-6">{description}</p>
      ) : (
        <div className="mb-4" />
      )}
      {children}
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[13px] text-vf-form mb-1.5 font-medium">{label}</span>
      {children}
      {hint ? <span className="block text-[12px] text-vf-body mt-1">{hint}</span> : null}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full h-10 px-3 rounded-[2px] border border-vf-form/40 text-vf-charcoal bg-white focus:border-vf-red focus:outline-none ${
        props.className ?? ""
      }`}
    />
  );
}

function PrimaryButton({
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center h-10 px-4 rounded-[2px] bg-vf-red text-white text-[14px] font-bold uppercase tracking-wider hover:bg-[#b80000] disabled:opacity-60 transition-colors ${
        rest.className ?? ""
      }`}
    >
      {children}
    </button>
  );
}

function StatusToast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="mt-3 text-[13px] text-green-700">{message}</p>
  );
}

// ---------------- Counter tab ----------------

function CounterTab({
  latest,
  latestOcr,
}: {
  latest: CounterReading | null;
  latestOcr: CounterReading | null;
}) {
  const [amount, setAmount] = useState<string>(latest?.amount_pln?.toString() ?? "");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setStatus(null);
    try {
      const res = await fetch("/api/admin/counter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount), note }),
      });
      if (!res.ok) throw new Error("Nie udało się zapisać");
      setStatus("Zapisano nowy odczyt ręczny.");
      setNote("");
      router.refresh();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Błąd");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Card title="Aktualny stan licznika">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-[2px] border border-black/5 p-5">
            <p className="eyebrow text-vf-red">Wyświetlana na stronie</p>
            <p className="mt-2 text-vf-charcoal tnum text-[32px] font-bold">
              {latest ? formatPLN(latest.amount_pln) : "—"}
            </p>
            <p className="mt-1 text-[12px] text-vf-body">
              Źródło: {latest?.source === "ocr" ? "OCR" : latest?.source === "manual" ? "Ręczne" : "—"}
              {" · "}
              {formatDateTime(latest?.created_at)}
            </p>
          </div>
          <div className="rounded-[2px] border border-black/5 p-5">
            <p className="eyebrow text-vf-body">Ostatni odczyt OCR</p>
            <p className="mt-2 text-vf-charcoal tnum text-[32px] font-bold">
              {latestOcr ? formatPLN(latestOcr.amount_pln) : "—"}
            </p>
            <p className="mt-1 text-[12px] text-vf-body">
              {formatDateTime(latestOcr?.created_at)}
            </p>
          </div>
        </div>
      </Card>

      <Card
        title="Override ręczny"
        description="Gdy OCR się rypnie albo chcesz zaokrąglić do ładnej kwoty."
      >
        <form onSubmit={submit} className="grid md:grid-cols-2 gap-4">
          <Field label="Kwota w PLN" hint="Tylko liczba, bez 'zł'.">
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </Field>
          <Field label="Notatka (opcjonalna)" hint="Do logu.">
            <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
          </Field>
          <div className="md:col-span-2 flex items-center gap-3">
            <PrimaryButton type="submit" disabled={submitting}>
              {submitting ? "Zapisywanie…" : "Zapisz"}
            </PrimaryButton>
            <StatusToast message={status} />
          </div>
        </form>
      </Card>
    </>
  );
}

// ---------------- Links tab ----------------

function LinksTab({ settings }: { settings: Record<string, string> }) {
  const [state, setState] = useState({
    donation_url_1: settings.donation_url_1 || "",
    donation_label_1: settings.donation_label_1 || "Tipply",
    donation_url_2: settings.donation_url_2 || "",
    donation_label_2: settings.donation_label_2 || "Siepomaga",
    stream_end_iso: settings.stream_end_iso || "",
  });
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      });
      if (!res.ok) throw new Error("Nie udało się zapisać");
      setStatus("Zapisano.");
      router.refresh();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Błąd");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      title="Linki do wpłat i koniec streamu"
      description="Dwa publiczne linki do zrzutek (Tipply, Siepomaga) + data zakończenia transmisji."
    >
      <form onSubmit={save} className="grid md:grid-cols-2 gap-4">
        <Field label="Tipply — URL">
          <Input
            type="url"
            value={state.donation_url_1}
            onChange={(e) => setState({ ...state, donation_url_1: e.target.value })}
            placeholder="https://tipply.pl/@..."
          />
        </Field>
        <Field label="Tipply — etykieta">
          <Input
            value={state.donation_label_1}
            onChange={(e) => setState({ ...state, donation_label_1: e.target.value })}
          />
        </Field>

        <Field label="Siepomaga — URL">
          <Input
            type="url"
            value={state.donation_url_2}
            onChange={(e) => setState({ ...state, donation_url_2: e.target.value })}
            placeholder="https://www.siepomaga.pl/..."
          />
        </Field>
        <Field label="Siepomaga — etykieta">
          <Input
            value={state.donation_label_2}
            onChange={(e) => setState({ ...state, donation_label_2: e.target.value })}
          />
        </Field>

        <Field
          label="Koniec transmisji (data i godzina)"
          hint="Godzina w strefie Europe/Warsaw. Countdown tyka wszędzie do tej samej sekundy. Puste = ukryty."
        >
          <Input
            type="datetime-local"
            value={state.stream_end_iso}
            onChange={(e) => setState({ ...state, stream_end_iso: e.target.value })}
          />
          {state.stream_end_iso ? (
            <span className="block text-[12px] text-green-700 mt-1">
              Site zrozumie jako: {formatWarsawLabel(state.stream_end_iso) ?? "—"} (Warszawa)
            </span>
          ) : null}
        </Field>

        <div className="md:col-span-2 flex items-center gap-3 pt-2">
          <PrimaryButton type="submit" disabled={saving}>
            {saving ? "Zapisywanie…" : "Zapisz"}
          </PrimaryButton>
          <StatusToast message={status} />
        </div>
      </form>
    </Card>
  );
}
