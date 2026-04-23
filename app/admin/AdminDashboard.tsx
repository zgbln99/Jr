"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CounterReading, Guest } from "@/lib/db";
import { normalizePhotoUrl } from "@/lib/media";

type Props = {
  settings: Record<string, string>;
  guests: Guest[];
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

export function AdminDashboard({ settings, guests, latest, latestOcr }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"counter" | "content" | "guests" | "links">("counter");

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <header className="bg-white border-b border-stripe-border">
        <div className="max-w-[1180px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-block h-6 w-6 rounded-[6px] bg-gradient-to-br from-stripe-purple to-stripe-ruby" />
            <span className="text-stripe-navy text-[14px]">jrjr.pl · admin</span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/"
              className="text-[13px] text-stripe-body hover:text-stripe-purple"
            >
              Podgląd strony
            </a>
            <button
              onClick={logout}
              className="text-[13px] text-stripe-body hover:text-stripe-purple"
            >
              Wyloguj
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-[1180px] mx-auto px-6 py-10">
        <h1
          className="text-stripe-navy font-light mb-2"
          style={{ fontSize: "2rem", letterSpacing: "-0.02em", lineHeight: 1.1 }}
        >
          Panel zarządzania
        </h1>
        <p className="text-stripe-body text-[14px] mb-8">
          Ręczna kontrola nad licznikiem, treścią strony, listą gości i linkami
          do zrzutek.
        </p>

        <div className="flex gap-1 mb-8 border-b border-stripe-border">
          {(
            [
              ["counter", "Licznik"],
              ["links", "Linki i countdown"],
              ["content", "Treść"],
              ["guests", "Goście"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 text-[14px] rounded-t-[4px] -mb-px border-b-2 ${
                tab === key
                  ? "border-stripe-purple text-stripe-navy"
                  : "border-transparent text-stripe-body hover:text-stripe-navy"
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
        {tab === "content" ? <ContentTab settings={settings} /> : null}
        {tab === "guests" ? <GuestsTab initial={guests} /> : null}
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
    <section className="bg-white rounded-[6px] border border-stripe-border shadow-stripe-soft p-6 mb-6">
      <h2 className="text-stripe-navy font-light text-[22px] tracking-tight">
        {title}
      </h2>
      {description ? (
        <p className="text-stripe-body text-[14px] mt-1 mb-6">{description}</p>
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
      <span className="block text-[13px] text-stripe-label mb-1.5">{label}</span>
      {children}
      {hint ? <span className="block text-[12px] text-stripe-body mt-1">{hint}</span> : null}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full h-10 px-3 rounded-[4px] border border-stripe-border text-stripe-navy bg-white focus:border-stripe-purple focus:outline-none ${
        props.className ?? ""
      }`}
    />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full min-h-[120px] px-3 py-2 rounded-[4px] border border-stripe-border text-stripe-navy bg-white focus:border-stripe-purple focus:outline-none ${
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
      className={`inline-flex items-center h-10 px-4 rounded-[4px] bg-stripe-purple text-white text-[14px] hover:bg-stripe-purple-hover disabled:opacity-60 transition-colors ${
        rest.className ?? ""
      }`}
    >
      {children}
    </button>
  );
}

function GhostButton({
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center h-10 px-4 rounded-[4px] border border-stripe-purple-light text-stripe-purple text-[14px] hover:bg-stripe-purple/5 disabled:opacity-60 transition-colors ${
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
    <p className="mt-3 text-[13px] text-stripe-success-text">{message}</p>
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
          <div className="rounded-[6px] border border-stripe-border p-5">
            <p className="text-[11px] uppercase tracking-[0.14em] text-stripe-purple">
              Wyświetlana na stronie
            </p>
            <p className="mt-2 text-stripe-navy tnum text-[32px] font-light">
              {latest ? formatPLN(latest.amount_pln) : "—"}
            </p>
            <p className="mt-1 text-[12px] text-stripe-body">
              Źródło: {latest?.source === "ocr" ? "OCR" : latest?.source === "manual" ? "Ręczne" : "—"}
              {" · "}
              {formatDateTime(latest?.created_at)}
            </p>
          </div>
          <div className="rounded-[6px] border border-stripe-border p-5">
            <p className="text-[11px] uppercase tracking-[0.14em] text-stripe-body">
              Ostatni odczyt OCR
            </p>
            <p className="mt-2 text-stripe-navy tnum text-[32px] font-light">
              {latestOcr ? formatPLN(latestOcr.amount_pln) : "—"}
            </p>
            <p className="mt-1 text-[12px] text-stripe-body">
              {formatDateTime(latestOcr?.created_at)}
            </p>
          </div>
        </div>
      </Card>

      <Card
        title="Override ręczny"
        description="Gdy OCR się rypnie albo chcesz zaokrąglić do ładnej kwoty, wpisz wartość ręcznie. Pojawi się natychmiast na stronie."
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
          <Field label="Notatka (opcjonalna)" hint="Tylko do logu, np. 'korekta po rozmowie ze zrzutką'.">
            <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
          </Field>
          <div className="md:col-span-2 flex items-center gap-3">
            <PrimaryButton type="submit" disabled={submitting}>
              {submitting ? "Zapisywanie…" : "Zapisz jako ręczny odczyt"}
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
    donation_label_1: settings.donation_label_1 || "Zrzutka 1",
    donation_url_2: settings.donation_url_2 || "",
    donation_label_2: settings.donation_label_2 || "Zrzutka 2",
    stream_end_iso: settings.stream_end_iso || "",
    foundation_url: settings.foundation_url || "",
    latwogang_ig: settings.latwogang_ig || "",
    bedoes_ig: settings.bedoes_ig || "",
    cancerfighters_ig: settings.cancerfighters_ig || "",
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
      title="Linki i countdown"
      description="Dwa linki do zrzutek (bez prowizji), data zakończenia transmisji, linki do socjali."
    >
      <form onSubmit={save} className="grid md:grid-cols-2 gap-4">
        <Field label="Zrzutka 1 — URL">
          <Input
            type="url"
            value={state.donation_url_1}
            onChange={(e) => setState({ ...state, donation_url_1: e.target.value })}
            placeholder="https://zrzutka.pl/..."
          />
        </Field>
        <Field label="Zrzutka 1 — etykieta">
          <Input
            value={state.donation_label_1}
            onChange={(e) => setState({ ...state, donation_label_1: e.target.value })}
          />
        </Field>

        <Field label="Zrzutka 2 — URL">
          <Input
            type="url"
            value={state.donation_url_2}
            onChange={(e) => setState({ ...state, donation_url_2: e.target.value })}
            placeholder="https://zrzutka.pl/..."
          />
        </Field>
        <Field label="Zrzutka 2 — etykieta">
          <Input
            value={state.donation_label_2}
            onChange={(e) => setState({ ...state, donation_label_2: e.target.value })}
          />
        </Field>

        <Field
          label="Koniec transmisji (data i godzina)"
          hint="Format: YYYY-MM-DDTHH:MM (np. 2026-05-02T21:00). Puste = ukryty countdown."
        >
          <Input
            type="datetime-local"
            value={state.stream_end_iso}
            onChange={(e) => setState({ ...state, stream_end_iso: e.target.value })}
          />
        </Field>
        <Field label="Strona fundacji">
          <Input
            type="url"
            value={state.foundation_url}
            onChange={(e) => setState({ ...state, foundation_url: e.target.value })}
          />
        </Field>

        <Field label="Łatwogang — Instagram URL">
          <Input
            type="url"
            value={state.latwogang_ig}
            onChange={(e) => setState({ ...state, latwogang_ig: e.target.value })}
            placeholder="https://instagram.com/..."
          />
        </Field>
        <Field label="Bedoes — Instagram URL">
          <Input
            type="url"
            value={state.bedoes_ig}
            onChange={(e) => setState({ ...state, bedoes_ig: e.target.value })}
          />
        </Field>

        <Field label="Cancer Fighters — Instagram URL">
          <Input
            type="url"
            value={state.cancerfighters_ig}
            onChange={(e) => setState({ ...state, cancerfighters_ig: e.target.value })}
          />
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

// ---------------- Content tab ----------------

function ContentTab({ settings }: { settings: Record<string, string> }) {
  const [state, setState] = useState({
    about_text: settings.about_text || "",
    initiators_text: settings.initiators_text || "",
    foundation_text: settings.foundation_text || "",
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
      title="Treść sekcji"
      description="Opisy pokazywane na stronie głównej. Enter = nowa linia."
    >
      <form onSubmit={save} className="space-y-4">
        <Field label="O akcji">
          <Textarea
            value={state.about_text}
            onChange={(e) => setState({ ...state, about_text: e.target.value })}
            rows={6}
          />
        </Field>
        <Field label="Inicjatorzy">
          <Textarea
            value={state.initiators_text}
            onChange={(e) => setState({ ...state, initiators_text: e.target.value })}
            rows={5}
          />
        </Field>
        <Field label="Fundacja Cancer Fighters">
          <Textarea
            value={state.foundation_text}
            onChange={(e) => setState({ ...state, foundation_text: e.target.value })}
            rows={5}
          />
        </Field>
        <div className="flex items-center gap-3 pt-2">
          <PrimaryButton type="submit" disabled={saving}>
            {saving ? "Zapisywanie…" : "Zapisz"}
          </PrimaryButton>
          <StatusToast message={status} />
        </div>
      </form>
    </Card>
  );
}

// ---------------- Guests tab ----------------

function emptyGuest(): Omit<Guest, "id" | "created_at" | "updated_at"> {
  return {
    name: "",
    handle: null,
    instagram: null,
    appearance_date: null,
    status: "upcoming",
    photo_url: null,
    sort_order: 0,
  };
}

function GuestsTab({ initial }: { initial: Guest[] }) {
  const [guests, setGuests] = useState<Guest[]>(initial);
  const [draft, setDraft] = useState(emptyGuest());
  const [editId, setEditId] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const router = useRouter();

  function draftFromGuest(g: Guest) {
    const { id: _id, created_at: _c, updated_at: _u, ...rest } = g;
    return rest;
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    const res = await fetch("/api/admin/guests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    if (!res.ok) {
      setStatus("Nie udało się dodać gościa");
      return;
    }
    const created = (await res.json()) as Guest;
    setGuests([...guests, created]);
    setDraft(emptyGuest());
    setStatus("Dodano gościa.");
    router.refresh();
  }

  async function update(e: React.FormEvent) {
    e.preventDefault();
    if (editId == null) return;
    setStatus(null);
    const res = await fetch(`/api/admin/guests/${editId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    if (!res.ok) {
      setStatus("Nie udało się zapisać");
      return;
    }
    const updated = (await res.json()) as Guest;
    setGuests(guests.map((g) => (g.id === updated.id ? updated : g)));
    setDraft(emptyGuest());
    setEditId(null);
    setStatus("Zapisano.");
    router.refresh();
  }

  async function remove(id: number) {
    if (!confirm("Usunąć tego gościa?")) return;
    const res = await fetch(`/api/admin/guests/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setStatus("Nie udało się usunąć");
      return;
    }
    setGuests(guests.filter((g) => g.id !== id));
    router.refresh();
  }

  return (
    <>
      <Card
        title={editId == null ? "Dodaj gościa" : "Edytuj gościa"}
        description="Imię i pseudonim (opcjonalnie), link do Instagrama, data wystąpienia i status."
      >
        <form onSubmit={editId == null ? create : update} className="grid md:grid-cols-2 gap-4">
          <Field label="Imię / nazwa">
            <Input
              required
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </Field>
          <Field label="Pseudonim / handle" hint="np. latwogang (bez @)">
            <Input
              value={draft.handle ?? ""}
              onChange={(e) => setDraft({ ...draft, handle: e.target.value })}
            />
          </Field>
          <Field label="Instagram" hint="URL lub sama nazwa użytkownika">
            <Input
              value={draft.instagram ?? ""}
              onChange={(e) => setDraft({ ...draft, instagram: e.target.value })}
              placeholder="https://instagram.com/..."
            />
          </Field>
          <Field label="Data wystąpienia" hint="Dowolny format, np. 2026-04-25 albo 'piątek wieczór'">
            <Input
              value={draft.appearance_date ?? ""}
              onChange={(e) => setDraft({ ...draft, appearance_date: e.target.value })}
            />
          </Field>
          <Field label="Status">
            <select
              value={draft.status}
              onChange={(e) =>
                setDraft({ ...draft, status: e.target.value === "past" ? "past" : "upcoming" })
              }
              className="w-full h-10 px-3 rounded-[4px] border border-stripe-border text-stripe-navy bg-white focus:border-stripe-purple focus:outline-none"
            >
              <option value="upcoming">Wkrótce</option>
              <option value="past">Już był</option>
            </select>
          </Field>
          <Field
            label="Zdjęcie — URL (opcjonalnie)"
            hint="Dropbox: wklej zwykły link do pliku (z '?dl=0') — sam zamienię na raw. Google Drive i bezpośrednie linki też działają."
          >
            <Input
              value={draft.photo_url ?? ""}
              onChange={(e) => setDraft({ ...draft, photo_url: e.target.value })}
              placeholder="https://www.dropbox.com/scl/fi/.../photo.jpg?dl=0"
            />
            {draft.photo_url ? (
              <div className="mt-2 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={normalizePhotoUrl(draft.photo_url) ?? ""}
                  alt="podgląd"
                  className="h-16 w-16 rounded-[4px] object-cover border border-stripe-border bg-stripe-purple-soft"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.opacity = "0.2";
                  }}
                />
                <span className="text-[11px] text-stripe-body break-all">
                  {normalizePhotoUrl(draft.photo_url)}
                </span>
              </div>
            ) : null}
          </Field>
          <Field label="Kolejność sortowania" hint="Mniejsza liczba = wyżej na liście">
            <Input
              type="number"
              value={draft.sort_order}
              onChange={(e) =>
                setDraft({ ...draft, sort_order: Number.parseInt(e.target.value, 10) || 0 })
              }
            />
          </Field>
          <div className="md:col-span-2 flex items-center gap-3">
            <PrimaryButton type="submit">
              {editId == null ? "Dodaj" : "Zapisz zmiany"}
            </PrimaryButton>
            {editId != null ? (
              <GhostButton
                type="button"
                onClick={() => {
                  setEditId(null);
                  setDraft(emptyGuest());
                }}
              >
                Anuluj
              </GhostButton>
            ) : null}
            <StatusToast message={status} />
          </div>
        </form>
      </Card>

      <Card title={`Lista gości (${guests.length})`}>
        {guests.length === 0 ? (
          <p className="text-[14px] text-stripe-body">Jeszcze nie ma nikogo na liście.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-stripe-label border-b border-stripe-border">
                  <th className="py-2 pr-4 font-normal">Imię</th>
                  <th className="py-2 pr-4 font-normal">Handle</th>
                  <th className="py-2 pr-4 font-normal">Data</th>
                  <th className="py-2 pr-4 font-normal">Status</th>
                  <th className="py-2 pr-4 font-normal">IG</th>
                  <th className="py-2 pr-4 font-normal">Sort</th>
                  <th className="py-2 pr-4 font-normal"></th>
                </tr>
              </thead>
              <tbody>
                {guests.map((g) => (
                  <tr key={g.id} className="border-b border-stripe-border/60">
                    <td className="py-2 pr-4 text-stripe-navy">{g.name}</td>
                    <td className="py-2 pr-4 text-stripe-body">{g.handle ?? "—"}</td>
                    <td className="py-2 pr-4 text-stripe-body">{g.appearance_date ?? "—"}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-[4px] text-[11px] uppercase tracking-wide ${
                          g.status === "upcoming"
                            ? "bg-stripe-magenta-light text-stripe-ruby"
                            : "bg-stripe-purple-soft text-stripe-purple-deep"
                        }`}
                      >
                        {g.status === "upcoming" ? "Wkrótce" : "Był"}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-stripe-body truncate max-w-[220px]">
                      {g.instagram ? (
                        <a
                          className="text-stripe-purple"
                          href={g.instagram}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {g.instagram}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 pr-4 tnum text-stripe-body">{g.sort_order}</td>
                    <td className="py-2 pr-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setDraft(draftFromGuest(g));
                            setEditId(g.id);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className="text-stripe-purple hover:text-stripe-purple-hover"
                        >
                          Edytuj
                        </button>
                        <button
                          onClick={() => remove(g.id)}
                          className="text-stripe-ruby hover:underline"
                        >
                          Usuń
                        </button>
                      </div>
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
