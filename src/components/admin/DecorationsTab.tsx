"use client";

import Image from "next/image";
import { ImagePlus, Trash2 } from "lucide-react";
import { Label } from "radix-ui";
import { useRef, useState } from "react";
import type { Decoration } from "@/lib/schema";
import { Button, Card, ConfirmDialog, Empty, inputClass } from "./ui";

export function DecorationsTab({
  decorations,
  restaurants,
  canWrite,
  onChanged,
}: {
  decorations: Decoration[];
  restaurants: string[];
  canWrite: boolean;
  onChanged: () => void;
}) {
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !name) return;
    setSaving(true);
    setError(null);
    const form = new FormData();
    form.set("restaurant_name", name);
    form.set("image", file);
    form.set("display_order", String(decorations.length));
    try {
      const res = await fetch("/api/decorations", { method: "POST", body: form });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Échec de l'envoi");
        return;
      }
      setName("");
      setFile(null);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function update(id: string, patch: Partial<Pick<Decoration, "display_order" | "restaurant_name">>) {
    await fetch(`/api/decorations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    onChanged();
  }

  async function remove(id: string) {
    await fetch(`/api/decorations/${id}`, { method: "DELETE" });
    onChanged();
  }

  return (
    <div className="flex flex-col gap-6">
      {canWrite && (
        <Card title="Ajouter une décoration (question 4)">
          <form onSubmit={add} className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <div className="flex flex-col gap-1">
              <Label.Root htmlFor="deco-name" className="text-xs font-semibold text-muted dark:text-zinc-400">
                Restaurant
              </Label.Root>
              <input
                id="deco-name"
                list="deco-restaurants"
                required
                minLength={2}
                maxLength={150}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="CHAMAS TACOS - ..."
                className={inputClass}
              />
              <datalist id="deco-restaurants">
                {restaurants.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </div>
            <div className="flex flex-col gap-1">
              <Label.Root htmlFor="deco-file" className="text-xs font-semibold text-muted dark:text-zinc-400">
                Photo (JPG, PNG, WebP · 8 Mo max · format paysage 16:9 conseillé)
              </Label.Root>
              <input
                id="deco-file"
                ref={fileRef}
                type="file"
                required
                accept="image/jpeg,image/png,image/webp,image/avif"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFile(f);
                  if (preview) URL.revokeObjectURL(preview);
                  setPreview(f ? URL.createObjectURL(f) : null);
                }}
                className="text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-ink"
              />
            </div>
            <Button type="submit" variant="primary" disabled={saving || !file || !name}>
              <ImagePlus className="h-4 w-4" aria-hidden /> {saving ? "Envoi…" : "Ajouter"}
            </Button>
          </form>
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:)
            <img src={preview} alt="Aperçu" className="mt-4 aspect-video w-64 rounded-lg object-cover" />
          )}
          {error && <p role="alert" className="mt-3 animate-shake text-sm font-medium text-red-600">{error}</p>}
          <p className="mt-3 text-xs text-muted dark:text-zinc-400">
            Les images sont automatiquement converties en WebP/AVIF et redimensionnées à l&apos;affichage.
          </p>
        </Card>
      )}

      <Card title={`Décorations en ligne (${decorations.length})`}>
        {decorations.length === 0 ? (
          <Empty>Aucune décoration. Les votants verront un message d&apos;attente à la question 4.</Empty>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {decorations.map((d) => (
              <li key={d.id} className="overflow-hidden rounded-lg border border-line dark:border-zinc-800">
                <div className="relative aspect-video bg-gray-100">
                  <Image src={d.image_url} alt={d.restaurant_name} fill sizes="(min-width: 1280px) 400px, 50vw" className="object-cover" />
                </div>
                <div className="flex items-center gap-2 p-3">
                  <span className="flex-1 text-sm font-medium text-ink dark:text-zinc-100">{d.restaurant_name}</span>
                  <label className="flex items-center gap-1 text-xs text-muted">
                    Ordre
                    <input
                      type="number"
                      min={0}
                      max={1000}
                      defaultValue={d.display_order}
                      disabled={!canWrite}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isInteger(v) && v !== d.display_order) void update(d.id, { display_order: v });
                      }}
                      className={`${inputClass} w-16`}
                    />
                  </label>
                  {canWrite && (
                    <ConfirmDialog
                      title="Supprimer cette décoration ?"
                      description="Elle disparaîtra du questionnaire. Les votes déjà enregistrés pour elle ne seront plus comptés."
                      onConfirm={() => remove(d.id)}
                      trigger={
                        <Button variant="ghost" aria-label={`Supprimer ${d.restaurant_name}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      }
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
