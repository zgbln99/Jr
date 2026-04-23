"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Region = {
  id: number;
  name: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  enabled: 0 | 1;
  sort_order: number;
  last_amount: number | null;
  last_parsed_at: number | null;
  created_at: number;
  updated_at: number;
};

type TestRegion = {
  id: number;
  name: string | null;
  amounts: number[];
  text: string;
  pickedAmount: number | null;
  usedAmount: number | null;
  source: "fresh" | "cached" | "missing";
};

type TestResult = {
  regions: TestRegion[];
  sum: number;
  engine: string;
};

type DraftRect = { x: number; y: number; width: number; height: number } | null;

function formatPLN(n: number): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 2,
  }).format(n);
}

export function OcrCalibration({ initial }: { initial: Region[] }) {
  const [regions, setRegions] = useState<Region[]>(initial);
  const [frameUrl, setFrameUrl] = useState<string>(`/api/admin/ocr/frame?t=${Date.now()}`);
  const [frameMissing, setFrameMissing] = useState<boolean>(false);
  const [busy, setBusy] = useState<"refresh" | "test" | "wipe" | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const imgRef = useRef<HTMLImageElement>(null);
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);

  const [draft, setDraft] = useState<DraftRect>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  const refreshFrame = useCallback(async () => {
    setBusy("refresh");
    setStatus(null);
    try {
      const res = await fetch("/api/admin/ocr/frame", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Nie udało się pobrać klatki");
      }
      setFrameUrl(`/api/admin/ocr/frame?t=${Date.now()}`);
      setFrameMissing(false);
      setStatus("Pobrano świeżą klatkę.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }, []);

  // Just reload the cached frame (latest upload from home-relay) without
  // forcing a fresh stream pull on the VPS.
  function reloadFrame() {
    setFrameUrl(`/api/admin/ocr/frame?t=${Date.now()}`);
    setFrameMissing(false);
  }

  async function saveRegion(rect: { x: number; y: number; width: number; height: number }) {
    const res = await fetch("/api/admin/ocr/regions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...rect, name: null, enabled: 1 }),
    });
    if (!res.ok) {
      setStatus("Nie udało się zapisać obszaru");
      return;
    }
    const created = (await res.json()) as Region;
    setRegions((rs) => [...rs, created]);
    setStatus(`Dodano obszar #${created.id}. Kliknij „Test OCR" żeby sprawdzić.`);
  }

  async function patchRegion(id: number, patch: Partial<Region>) {
    const res = await fetch(`/api/admin/ocr/regions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      setStatus("Nie udało się zapisać");
      return;
    }
    const updated = (await res.json()) as Region;
    setRegions((rs) => rs.map((r) => (r.id === id ? updated : r)));
  }

  async function removeRegion(id: number) {
    if (!confirm(`Usunąć obszar #${id}?`)) return;
    const res = await fetch(`/api/admin/ocr/regions/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setStatus("Nie udało się usunąć");
      return;
    }
    setRegions((rs) => rs.filter((r) => r.id !== id));
  }

  async function removeAll() {
    if (regions.length === 0) return;
    if (!confirm(`Usunąć WSZYSTKIE ${regions.length} obszary? Tej operacji nie można cofnąć.`)) return;
    setBusy("wipe");
    try {
      await Promise.all(
        regions.map((r) =>
          fetch(`/api/admin/ocr/regions/${r.id}`, { method: "DELETE" }),
        ),
      );
      setRegions([]);
      setTestResult(null);
      setStatus("Skasowano wszystkie obszary. Narysuj nowe.");
    } finally {
      setBusy(null);
    }
  }

  async function runTest() {
    setBusy("test");
    setStatus(null);
    try {
      const res = await fetch("/api/admin/ocr/test", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Test się nie powiódł");
      }
      const data = (await res.json()) as TestResult;
      setTestResult(data);
      setStatus(
        `Test OK. Silnik: ${data.engine}. Suma: ${formatPLN(data.sum)}.`,
      );
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  // Draw rectangle via mouse
  function onMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (!imgSize) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    dragStart.current = { x, y };
    setDraft({ x, y, width: 0, height: 0 });
  }

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!dragStart.current || !imgSize) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const cx = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const cy = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    const x = Math.min(dragStart.current.x, cx);
    const y = Math.min(dragStart.current.y, cy);
    const width = Math.abs(cx - dragStart.current.x);
    const height = Math.abs(cy - dragStart.current.y);
    setDraft({ x, y, width, height });
  }

  function onMouseUp() {
    const d = draft;
    dragStart.current = null;
    setDraft(null);
    if (!d || d.width < 0.01 || d.height < 0.01) return;
    saveRegion(d);
  }

  useEffect(() => {
    function onImgLoad() {
      const img = imgRef.current;
      if (!img) return;
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
      setFrameMissing(false);
    }
    function onImgError() {
      setFrameMissing(true);
    }
    const img = imgRef.current;
    img?.addEventListener("load", onImgLoad);
    img?.addEventListener("error", onImgError);
    return () => {
      img?.removeEventListener("load", onImgLoad);
      img?.removeEventListener("error", onImgError);
    };
  }, [frameUrl]);

  const resultByRegionId = new Map<number, TestRegion>();
  if (testResult) for (const r of testResult.regions) resultByRegionId.set(r.id, r);

  return (
    <div className="space-y-6">
      <div className="rounded-[6px] border border-black/10 bg-white p-6">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <button
            onClick={refreshFrame}
            disabled={busy !== null}
            className="inline-flex items-center h-10 px-4 rounded-[2px] bg-vf-red text-white text-[13px] font-bold uppercase tracking-wider hover:bg-[#b80000] disabled:opacity-60"
          >
            {busy === "refresh" ? "Pobieram…" : "Pobierz świeżą klatkę"}
          </button>
          <button
            onClick={reloadFrame}
            className="inline-flex items-center h-10 px-4 rounded-[2px] border border-vf-form/40 text-vf-form text-[13px] font-bold uppercase tracking-wider hover:bg-vf-neutral"
            title="Przeładuj ostatnio przesłaną klatkę z relay-a (bez ponownego ściągania ze streamu)"
          >
            Odśwież obrazek
          </button>
          <button
            onClick={runTest}
            disabled={busy !== null || regions.length === 0}
            className="inline-flex items-center h-10 px-4 rounded-[2px] border border-vf-red text-vf-red text-[13px] font-bold uppercase tracking-wider hover:bg-vf-red/5 disabled:opacity-60"
          >
            {busy === "test" ? "Testuję…" : `Test OCR (${regions.length})`}
          </button>
          <button
            onClick={removeAll}
            disabled={busy !== null || regions.length === 0}
            className="inline-flex items-center h-10 px-4 rounded-[2px] border border-vf-form/40 text-vf-form text-[13px] font-bold uppercase tracking-wider hover:bg-vf-neutral disabled:opacity-50 ml-auto"
          >
            {busy === "wipe" ? "Kasuję…" : `Usuń wszystkie (${regions.length})`}
          </button>
          {testResult ? (
            <span className="basis-full text-[13px] text-vf-body">
              Silnik: <strong className="text-vf-charcoal">{testResult.engine}</strong> · suma:{" "}
              <strong className="text-vf-charcoal tnum">{formatPLN(testResult.sum)}</strong>
            </span>
          ) : null}
        </div>

        <p className="text-[13px] text-vf-body mb-3">
          Narysuj myszką prostokąty nad kwotami, które chcesz sumować. Worker
          OCR-uje każdy z nich osobno i dodaje do siebie. Kliknięcie bez
          przeciągnięcia (rozmiar &lt; 1%) jest ignorowane.
        </p>

        <div
          className="relative inline-block w-full max-w-[1200px] border border-black/10 bg-vf-charcoal rounded-[4px] overflow-hidden select-none"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={() => {
            dragStart.current = null;
            setDraft(null);
          }}
          style={{ cursor: imgSize ? "crosshair" : "default" }}
        >
          {frameMissing ? (
            <div className="aspect-video flex items-center justify-center text-white/60 text-[13px] p-8 text-center">
              Brak klatki. Odpal home-relay na PC, lub kliknij „Pobierz świeżą klatkę".
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={imgRef}
              src={frameUrl}
              alt="Ostatnia klatka ze streamu"
              draggable={false}
              className="block w-full h-auto pointer-events-none"
            />
          )}

          {imgSize ? (
            <>
              {regions.map((r) => {
                const t = resultByRegionId.get(r.id);
                const ok = t?.source === "fresh";
                const cached = t?.source === "cached";
                const missing = t?.source === "missing";
                let borderColor = "#22c55e"; // active default green
                let bgColor = "rgba(34,197,94,0.12)";
                if (!r.enabled) {
                  borderColor = "#9ca3af";
                  bgColor = "rgba(156,163,175,0.10)";
                } else if (ok) {
                  borderColor = "#22c55e";
                  bgColor = "rgba(34,197,94,0.16)";
                } else if (cached) {
                  borderColor = "#f59e0b";
                  bgColor = "rgba(245,158,11,0.18)";
                } else if (missing) {
                  borderColor = "#e60000";
                  bgColor = "rgba(230,0,0,0.18)";
                }
                return (
                  <div
                    key={r.id}
                    className="absolute"
                    style={{
                      left: `${r.x * 100}%`,
                      top: `${r.y * 100}%`,
                      width: `${r.width * 100}%`,
                      height: `${r.height * 100}%`,
                      border: `2px solid ${borderColor}`,
                      background: bgColor,
                    }}
                  >
                    <span
                      className="absolute -top-6 left-0 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-[2px] text-white"
                      style={{ background: borderColor }}
                    >
                      #{r.id}
                      {r.name ? ` · ${r.name}` : ""}
                      {!r.enabled ? " · OFF" : ""}
                      {t?.usedAmount != null
                        ? ` · ${Math.round(t.usedAmount).toLocaleString("pl-PL")}`
                        : ""}
                    </span>
                  </div>
                );
              })}
              {draft ? (
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: `${draft.x * 100}%`,
                    top: `${draft.y * 100}%`,
                    width: `${draft.width * 100}%`,
                    height: `${draft.height * 100}%`,
                    border: "2px dashed #e60000",
                    background: "rgba(230,0,0,0.15)",
                  }}
                />
              ) : null}
            </>
          ) : null}
        </div>

        {status ? (
          <p className="mt-3 text-[13px] text-vf-charcoal">{status}</p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-vf-body uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-[2px]" style={{ background: "#22c55e" }} />
            zielony = świeży OCR
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-[2px]" style={{ background: "#f59e0b" }} />
            żółty = z pamięci (last_amount)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-[2px]" style={{ background: "#e60000" }} />
            czerwony = nic nie odczytał i brak pamięci
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-[2px]" style={{ background: "#9ca3af" }} />
            szary = wyłączony
          </span>
        </div>
      </div>

      <div className="rounded-[6px] border border-black/10 bg-white p-6">
        <h3 className="text-[18px] font-bold text-vf-charcoal mb-4">
          Obszary ({regions.length})
        </h3>
        {regions.length === 0 ? (
          <p className="text-[13px] text-vf-body">
            Jeszcze nie ma obszarów. Narysuj pierwszy prostokąt na klatce wyżej.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-vf-form border-b border-black/10">
                  <th className="py-2 pr-3 font-bold uppercase tracking-wider">#</th>
                  <th className="py-2 pr-3 font-bold uppercase tracking-wider">Nazwa</th>
                  <th className="py-2 pr-3 font-bold uppercase tracking-wider">Pozycja</th>
                  <th className="py-2 pr-3 font-bold uppercase tracking-wider">Aktywny</th>
                  <th className="py-2 pr-3 font-bold uppercase tracking-wider">Cache</th>
                  <th className="py-2 pr-3 font-bold uppercase tracking-wider">Ostatni test</th>
                  <th className="py-2 pr-3 font-bold uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody>
                {regions.map((r) => {
                  const t = resultByRegionId.get(r.id);
                  return (
                    <tr key={r.id} className="border-b border-black/5 align-top">
                      <td className="py-2 pr-3 text-vf-body tnum">{r.id}</td>
                      <td className="py-2 pr-3">
                        <input
                          defaultValue={r.name ?? ""}
                          placeholder="np. tipply"
                          onBlur={(e) =>
                            e.target.value !== (r.name ?? "")
                              ? patchRegion(r.id, { name: e.target.value || null } as Partial<Region>)
                              : undefined
                          }
                          className="w-full h-8 px-2 rounded-[2px] border border-vf-form/30 text-[13px] focus:border-vf-red focus:outline-none"
                        />
                      </td>
                      <td className="py-2 pr-3 text-vf-body tnum text-[12px]">
                        {`${(r.x * 100).toFixed(1)}% / ${(r.y * 100).toFixed(1)}% / ${(r.width * 100).toFixed(1)}% × ${(r.height * 100).toFixed(1)}%`}
                      </td>
                      <td className="py-2 pr-3">
                        <label className="inline-flex items-center gap-2 text-[13px]">
                          <input
                            type="checkbox"
                            checked={!!r.enabled}
                            onChange={(e) =>
                              patchRegion(r.id, {
                                enabled: e.target.checked ? 1 : 0,
                              } as Partial<Region>)
                            }
                          />
                          {r.enabled ? "tak" : "nie"}
                        </label>
                      </td>
                      <td className="py-2 pr-3 text-vf-body tnum text-[12px]">
                        {r.last_amount != null ? formatPLN(r.last_amount) : "—"}
                      </td>
                      <td className="py-2 pr-3 text-vf-body max-w-[280px]">
                        {t ? (
                          <div>
                            <div
                              className="tnum text-[13px] font-bold"
                              style={{
                                color:
                                  t.source === "fresh"
                                    ? "#16a34a"
                                    : t.source === "cached"
                                      ? "#d97706"
                                      : "#dc2626",
                              }}
                            >
                              {t.usedAmount != null
                                ? `${formatPLN(t.usedAmount)} (${t.source})`
                                : "— (missing)"}
                            </div>
                            <div className="text-[11px] text-vf-body/70 line-clamp-2">
                              raw: {t.text || "(pusto)"}
                            </div>
                          </div>
                        ) : (
                          <span className="text-vf-body/50">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <button
                          onClick={() => removeRegion(r.id)}
                          className="text-vf-red hover:underline font-bold uppercase tracking-wider text-[12px]"
                        >
                          Usuń
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
