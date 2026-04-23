"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CounterReading, OcrRegion } from "@/lib/db";
import { formatWarsawLabel } from "@/lib/time";
import { OcrCalibration } from "@/components/OcrCalibration";

type Props = {
  settings: Record<string, string>;
  regions: OcrRegion[];
  latest: CounterReading | null;
  latestOcr: CounterReading | null;
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

export function AdminDashboard({ settings, regions, latest, latestOcr }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"counter" | "links" | "ocr">("counter");

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
      </div>
    </div>
  );
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
