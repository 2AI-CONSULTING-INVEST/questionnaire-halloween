"use client";

import { useRouter } from "next/navigation";
import { Label } from "radix-ui";
import { useState } from "react";
import { Emoji } from "@/components/questionnaire/ui";

export default function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.replace("/admin");
        router.refresh();
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Connexion impossible");
    } catch {
      setError("Connexion impossible");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl border border-line bg-white p-8 shadow-sm">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-ink">
          <Emoji name="pumpkin" size={32} /> Backoffice
        </h1>
        <p className="mt-1 text-sm text-muted">Vote Halloween Chamas Tacos</p>
        <Label.Root htmlFor="password" className="mt-6 block text-sm font-semibold text-ink">
          Mot de passe
        </Label.Root>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-2 w-full rounded-lg border border-line px-3 py-2.5 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/40"
        />
        {error && (
          <p role="alert" className="mt-3 animate-shake text-sm font-medium text-red-600">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading || !password}
          className="mt-6 w-full rounded-full bg-brand py-2.5 font-bold text-black transition hover:shadow-md disabled:opacity-60"
        >
          {loading ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </main>
  );
}
