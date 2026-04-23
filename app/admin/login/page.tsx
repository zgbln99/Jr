"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Błędne dane logowania");
      }
      router.replace("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd logowania");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-white px-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8">
          <span className="inline-block h-7 w-7 rounded-[6px] bg-gradient-to-br from-stripe-purple to-stripe-ruby" />
          <span className="text-stripe-navy text-[16px]">jrjr.pl · admin</span>
        </div>
        <h1
          className="text-stripe-navy font-light mb-2"
          style={{ fontSize: "2rem", letterSpacing: "-0.02em", lineHeight: 1.1 }}
        >
          Zaloguj się
        </h1>
        <p className="text-stripe-body text-[14px] mb-8">
          Panel do zarządzania treścią strony i licznikiem.
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-stripe-label text-[13px] mb-1.5">
              Użytkownik
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              className="w-full h-10 px-3 rounded-[4px] border border-stripe-border text-stripe-navy bg-white focus:border-stripe-purple focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-stripe-label text-[13px] mb-1.5">
              Hasło
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="w-full h-10 px-3 rounded-[4px] border border-stripe-border text-stripe-navy bg-white focus:border-stripe-purple focus:outline-none"
            />
          </div>

          {error ? (
            <p className="text-stripe-ruby text-[13px]">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-10 px-4 rounded-[4px] bg-stripe-purple text-white text-[14px] hover:bg-stripe-purple-hover disabled:opacity-60 transition-colors"
          >
            {submitting ? "Logowanie…" : "Zaloguj"}
          </button>
        </form>
      </div>
    </main>
  );
}
