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
  created_at: number;
  updated_at: number;
};

type TestResult = {
  regions: Array<{ id: number; name: string | null; amounts: number[]; text: string }>;
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
  const [busy, setBusy] = useState<"refresh" | "test" | null>(null);
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
      setStatus("Pobrano świeżą klatkę ze streamu.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }, []);

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
    setStatus(`Dodano obszar #${created.id}. Kliknij 'Test OCR' żeby sprawdzić.`);
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
    if (!confirm("Usunąć ten obszar?")) return;
    const res = await fetch(`/api/admin/ocr/regions/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setStatus("Nie udało się usunąć");
      return;
    }
    setRegions((rs) => rs.filter((r) => r.id !== id));
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
    // Too small = accidental click, ignore.
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

  const resultByRegionId = new Map<number, TestResult["regions"][number]>();
  if (testResult) for (const r of testResult.regions) resultByRegionId.set(r.id, r);

  return (
    <div className="space-y-6">
      <div className="rounded-[6px] border border-stripe-border bg-white p-6">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <button
            onClick={refreshFrame}
            disabled={busy !== null}
            className="inline-flex items-center h-10 px-4 rounded-[4px] bg-stripe-purple text-white text-[14px] hover:bg-stripe-purple-hover disabled:opacity-60"
          >
            {busy === "refresh" ? "Pobieram…" : "Pobierz świeżą klatkę"}
          </button>
          <button
            onClick={runTest}
            disabled={busy !== null || regions.length === 0}
            className="inline-flex items-center h-10 px-4 rounded-[4px] border border-stripe-purple-light text-stripe-purple text-[14px] hover:bg-stripe-purple/5 disabled:opacity-60"
          >
            {busy === "test" ? "Testuję…" : `Test OCR (${regions.length} obszar${regions.length === 1 ? "" : "y"})`}
          </button>
          {testResult ? (
            <span className="text-[13px] text-stripe-body">
              Silnik: <strong className="text-stripe-navy">{testResult.engine}</strong> ·
              suma: <strong className="text-stripe-navy tnum">{formatPLN(testResult.sum)}</strong>
            </span>
          ) : null}
        </div>

        <p className="text-[13px] text-stripe-body mb-3">
          Narysuj myszką prostokąty nad kwotami, które chcesz sumować. Worker
          OCR-uje każdy z nich osobno i dodaje do siebie. Kliknięcie bez
          przeciągnięcia (rozmiar {"<"} 1%) jest ignorowane.
        </p>

        <div
          className="relative inline-block w-full max-w-[1100px] border border-stripe-border bg-stripe-dark-navy rounded-[4px] overflow-hidden select-none"
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
              Brak klatki. Kliknij „Pobierz świeżą klatkę" — worker potrzebuje
              yt-dlp + ffmpeg + cookies YouTube w <code>.env</code>.
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
              {regions.map((r) => (
                <div
                  key={r.id}
                  className={`absolute border-2 ${
                    r.enabled
                      ? "border-stripe-success bg-stripe-success/10"
                      : "border-stripe-body/50 bg-stripe-body/10"
                  }`}
                  style={{
                    left: `${r.x * 100}%`,
                    top: `${r.y * 100}%`,
                    width: `${r.width * 100}%`,
                    height: `${r.height * 100}%`,
                  }}
                >
                  <span className="absolute -top-5 left-0 px-1 text-[10px] bg-stripe-success text-white rounded-[2px]">
                    #{r.id}
                    {r.name ? ` · ${r.name}` : ""}
                  </span>
                </div>
              ))}
              {draft ? (
                <div
                  className="absolute border-2 border-stripe-ruby bg-stripe-ruby/15 pointer-events-none"
                  style={{
                    left: `${draft.x * 100}%`,
                    top: `${draft.y * 100}%`,
                    width: `${draft.width * 100}%`,
                    height: `${draft.height * 100}%`,
                  }}
                />
              ) : null}
            </>
          ) : null}
        </div>

        {status ? (
          <p className="mt-3 text-[13px] text-stripe-body">{status}</p>
        ) : null}
      </div>

      <div className="rounded-[6px] border border-stripe-border bg-white p-6">
        <h3 className="text-[16px] text-stripe-navy mb-4">
          Obszary ({regions.length})
        </h3>
        {regions.length === 0 ? (
          <p className="text-[13px] text-stripe-body">
            Jeszcze nie ma obszarów. Narysuj pierwszy prostokąt na klatce wyżej.
          </p>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-stripe-label border-b border-stripe-border">
                <th className="py-2 pr-3 font-normal">#</th>
                <th className="py-2 pr-3 font-normal">Nazwa</th>
                <th className="py-2 pr-3 font-normal">x / y / w / h</th>
                <th className="py-2 pr-3 font-normal">Status</th>
                <th className="py-2 pr-3 font-normal">Ostatni test OCR</th>
                <th className="py-2 pr-3 font-normal"></th>
              </tr>
            </thead>
            <tbody>
              {regions.map((r) => {
                const t = resultByRegionId.get(r.id);
                return (
                  <tr key={r.id} className="border-b border-stripe-border/60 align-top">
                    <td className="py-2 pr-3 text-stripe-body tnum">{r.id}</td>
                    <td className="py-2 pr-3">
                      <input
                        defaultValue={r.name ?? ""}
                        placeholder="opcjonalna nazwa"
                        onBlur={(e) =>
                          e.target.value !== (r.name ?? "")
                            ? patchRegion(r.id, { name: e.target.value || null } as Partial<Region>)
                            : undefined
                        }
                        className="w-full h-8 px-2 rounded-[4px] border border-stripe-border text-[13px] focus:border-stripe-purple focus:outline-none"
                      />
                    </td>
                    <td className="py-2 pr-3 text-stripe-body tnum">
                      {`${(r.x * 100).toFixed(1)}% / ${(r.y * 100).toFixed(1)}% / ${(
                        r.width * 100
                      ).toFixed(1)}% / ${(r.height * 100).toFixed(1)}%`}
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
                        Aktywny
                      </label>
                    </td>
                    <td className="py-2 pr-3 text-stripe-body max-w-[280px]">
                      {t ? (
                        <div>
                          <div className="tnum text-stripe-navy">
                            {t.amounts.length
                              ? t.amounts.map((n) => formatPLN(n)).join(", ")
                              : "—"}
                          </div>
                          <div className="text-[11px] text-stripe-body/80 line-clamp-2">
                            {t.text}
                          </div>
                        </div>
                      ) : (
                        <span className="text-stripe-body/50">—</span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <button
                        onClick={() => removeRegion(r.id)}
                        className="text-stripe-ruby hover:underline"
                      >
                        Usuń
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
