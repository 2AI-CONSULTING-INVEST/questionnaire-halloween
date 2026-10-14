"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { Restaurant } from "@/lib/schema";
import { Button, Card, ConfirmDialog, Empty, inputClass } from "./ui";
import { withBase } from "@/lib/base-path";

export function RestaurantsTab({ restaurants, canWrite, onChanged }: { restaurants: Restaurant[]; canWrite: boolean; onChanged: () => void }) {
  const [name, setName] = useState("CHAMAS TACOS - ");
  const [city, setCity] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(withBase("/api/restaurants"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, city }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Erreur");
      return;
    }
    setName("CHAMAS TACOS - ");
    setCity("");
    onChanged();
  }

  async function remove(id: string) {
    await fetch(withBase(`/api/restaurants/${id}`), { method: "DELETE" });
    onChanged();
  }

  return (
    <Card title={`Restaurants de la question 2 (${restaurants.length})`}>
      {canWrite && (
        <form onSubmit={add} className="mb-6 flex flex-wrap items-end gap-3">
          <input aria-label="Nom du restaurant" required minLength={2} maxLength={150} value={name} onChange={(e) => setName(e.target.value)} className={`${inputClass} min-w-72 flex-1`} />
          <input aria-label="Ville" placeholder="Ville (optionnel)" maxLength={100} value={city} onChange={(e) => setCity(e.target.value)} className={`${inputClass} w-48`} />
          <Button type="submit" variant="primary">
            <Plus className="h-4 w-4" aria-hidden /> Ajouter
          </Button>
          {error && <p role="alert" className="w-full animate-shake text-sm font-medium text-red-600">{error}</p>}
        </form>
      )}
      {restaurants.length === 0 ? (
        <Empty>Aucun restaurant.</Empty>
      ) : (
        <ul className="divide-y divide-line dark:divide-zinc-800">
          {restaurants.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
              <span className="text-sm font-medium text-ink dark:text-zinc-100">
                {r.name} {r.city && <span className="font-normal text-muted">· {r.city}</span>}
              </span>
              {canWrite && (
                <ConfirmDialog
                  title={`Retirer ${r.name} ?`}
                  description="Le restaurant ne sera plus proposé à la question 2. Les réponses existantes sont conservées."
                  confirmLabel="Retirer"
                  onConfirm={() => remove(r.id)}
                  trigger={
                    <Button variant="ghost" aria-label={`Retirer ${r.name}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  }
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
