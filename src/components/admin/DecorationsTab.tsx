"use client";

import Image from "next/image";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Film, Loader2, Play, Trash2, Upload, XCircle } from "lucide-react";
import { Label } from "radix-ui";
import { useMemo, useRef, useState } from "react";
import { MediaLightbox } from "@/components/media/MediaLightbox";
import { groupDecorations, mediaKind, shortName, thumbOf, type Decoration, type DecorationGroup } from "@/lib/schema";
import { prepareMedia, uploadMedia } from "./upload";
import { Button, Card, ConfirmDialog, Empty, inputClass } from "./ui";

type QueueItem = {
  key: string;
  name: string;
  status: "waiting" | "preparing" | "uploading" | "done" | "error";
  progress: number;
  message?: string;
};

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
  const groups = useMemo(() => groupDecorations(decorations), [decorations]);
  const missing = restaurants.filter((r) => !groups.some((g) => g.restaurant_name === r));
  const [viewer, setViewer] = useState<{ group: DecorationGroup; index: number } | null>(null);

  return (
    <div className="flex flex-col gap-6">
      {canWrite && <UploadCard restaurants={restaurants} onChanged={onChanged} />}

      <Card title={`Médias en ligne (${decorations.length}) · ${groups.length} restaurant${groups.length > 1 ? "s" : ""}`}>
        {groups.length === 0 ? (
          <Empty>Aucun média. Les votants verront un message d&apos;attente à la question 3.</Empty>
        ) : (
          <div className="flex flex-col gap-6">
            {groups.map((g) => (
              <GroupRow key={g.restaurant_name} group={g} canWrite={canWrite} onChanged={onChanged} onOpen={(index) => setViewer({ group: g, index })} />
            ))}
          </div>
        )}
        {missing.length > 0 && (
          <p className="mt-6 text-sm text-amber-700 dark:text-amber-400">
            Sans média (absents du vote) : {missing.map(shortName).join(", ")}
          </p>
        )}
      </Card>

      <MediaLightbox
        open={viewer !== null}
        onOpenChange={(open) => !open && setViewer(null)}
        title={viewer?.group.restaurant_name ?? ""}
        items={viewer?.group.items ?? []}
        startIndex={viewer?.index ?? 0}
      />
    </div>
  );
}

function UploadCard({ restaurants, onChanged }: { restaurants: string[]; onChanged: () => void }) {
  const [restaurant, setRestaurant] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const update = (key: string, patch: Partial<QueueItem>) =>
    setQueue((q) => q.map((it) => (it.key === key ? { ...it, ...patch } : it)));

  async function start(e: React.FormEvent) {
    e.preventDefault();
    if (!restaurant || files.length === 0) return;
    setBusy(true);
    const items = files.map((f, i) => ({ file: f, key: `${Date.now()}-${i}` }));
    setQueue(items.map(({ file, key }) => ({ key, name: file.name, status: "waiting", progress: 0 })));
    setFiles([]);
    if (fileRef.current) fileRef.current.value = "";

    for (const { file, key } of items) {
      try {
        update(key, { status: "preparing" });
        const media = await prepareMedia(file);
        update(key, { status: "uploading", message: media.warning });
        await uploadMedia(restaurant, media, (p) => update(key, { progress: p }));
        update(key, { status: "done", progress: 1 });
      } catch (err) {
        update(key, { status: "error", message: err instanceof Error ? err.message : "Échec de l'envoi" });
      }
    }
    setBusy(false);
    onChanged();
  }

  return (
    <Card title="Ajouter des photos ou vidéos (question 3)">
      <form onSubmit={start} className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <div className="flex flex-col gap-1">
          <Label.Root htmlFor="deco-restaurant" className="text-xs font-semibold text-muted dark:text-zinc-400">
            Restaurant
          </Label.Root>
          <select id="deco-restaurant" required value={restaurant} onChange={(e) => setRestaurant(e.target.value)} className={inputClass}>
            <option value="" disabled>
              Choisir un restaurant…
            </option>
            {restaurants.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label.Root htmlFor="deco-files" className="text-xs font-semibold text-muted dark:text-zinc-400">
            Photos / vidéos (plusieurs possibles)
          </Label.Root>
          <input
            id="deco-files"
            ref={fileRef}
            type="file"
            multiple
            required
            accept="image/*,video/mp4,video/quicktime,video/webm,.mov,.heic,.heif"
            onChange={(e) => setFiles([...(e.target.files ?? [])])}
            className="text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-ink"
          />
        </div>
        <Button type="submit" variant="primary" disabled={busy || !restaurant || files.length === 0}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="h-4 w-4" aria-hidden />}
          {busy ? "Envoi…" : `Envoyer${files.length > 1 ? ` (${files.length})` : ""}`}
        </Button>
      </form>

      {queue.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2" aria-live="polite">
          {queue.map((it) => (
            <li key={it.key} className="rounded-lg border border-line px-3 py-2 text-sm dark:border-zinc-800">
              <div className="flex items-center gap-2">
                {it.status === "done" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden />
                ) : it.status === "error" ? (
                  <XCircle className="h-4 w-4 shrink-0 text-error" aria-hidden />
                ) : (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted" aria-hidden />
                )}
                <span className="min-w-0 flex-1 truncate text-ink dark:text-zinc-100">{it.name}</span>
                <span className="shrink-0 text-xs text-muted dark:text-zinc-400">
                  {{ waiting: "En attente", preparing: "Préparation…", uploading: `${Math.round(it.progress * 100)} %`, done: "Ajouté", error: "Échec" }[it.status]}
                </span>
              </div>
              {it.status === "uploading" && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-zinc-800">
                  <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${it.progress * 100}%` }} />
                </div>
              )}
              {it.message && (
                <p className={`mt-1.5 flex gap-1.5 text-xs ${it.status === "error" ? "text-red-600 dark:text-red-400" : "text-amber-700 dark:text-amber-400"}`}>
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> {it.message}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-muted dark:text-zinc-400">
        <li>
          <strong>Format vertical (téléphone) conseillé</strong> : la plupart des votants sont sur mobile, les médias s&apos;affichent en entier en plein écran.
        </li>
        <li>Photos : tout format courant (même HEIC depuis un iPhone avec Safari). Elles sont redressées, compressées et nettoyées de leurs données GPS.</li>
        <li>Vidéos : MP4 ou MOV, 50 Mo maximum. Idéal : moins de 30 secondes, 720p, moins de 20 Mo. Une affiche est créée automatiquement.</li>
        <li>Le premier média d&apos;un restaurant sert de couverture. Les votes vont au restaurant, quel que soit le média regardé.</li>
      </ul>
    </Card>
  );
}

function GroupRow({
  group,
  canWrite,
  onChanged,
  onOpen,
}: {
  group: DecorationGroup;
  canWrite: boolean;
  onChanged: () => void;
  onOpen: (index: number) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const items = group.items;

  /** Échange deux médias puis renumérote l'ordre du restaurant (valeurs croissantes). */
  async function move(from: number, to: number) {
    if (to < 0 || to >= items.length) return;
    const orders = items.map((d) => d.display_order).sort((a, b) => a - b);
    for (let i = 1; i < orders.length; i++) if (orders[i] <= orders[i - 1]) orders[i] = orders[i - 1] + 1;
    const next = [...items];
    [next[from], next[to]] = [next[to], next[from]];
    setBusy(true);
    try {
      await Promise.all(
        next.map((d, i) =>
          d.display_order === orders[i]
            ? null
            : fetch(`/api/decorations/${d.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ display_order: orders[i] }),
              }),
        ),
      );
    } finally {
      setBusy(false);
      onChanged();
    }
  }

  async function remove(id: string) {
    setError(null);
    const res = await fetch(`/api/decorations/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Suppression impossible");
    }
    onChanged();
  }

  return (
    <section>
      <h3 className="mb-2 flex items-baseline gap-2 text-sm font-semibold text-ink dark:text-zinc-100">
        {group.restaurant_name}
        <span className="text-xs font-normal text-muted dark:text-zinc-400">
          {items.length} média{items.length > 1 ? "s" : ""}
        </span>
      </h3>
      <ul className="flex gap-3 overflow-x-auto pb-2">
        {items.map((d, i) => {
          const isVideo = mediaKind(d.image_url) === "video";
          return (
            <li key={d.id} className="w-28 shrink-0 overflow-hidden rounded-lg border border-line dark:border-zinc-800">
              <button
                type="button"
                onClick={() => onOpen(i)}
                aria-label={`Voir le média ${i + 1}`}
                className="relative block aspect-[3/4] w-full bg-gray-100 dark:bg-zinc-800"
              >
                <Image src={thumbOf(d)} alt="" fill sizes="112px" className="object-cover" />
                {isVideo && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white">
                      <Play className="ml-0.5 h-4 w-4" fill="currentColor" aria-hidden />
                    </span>
                  </span>
                )}
                {i === 0 && (
                  <span className="absolute left-1 top-1 rounded bg-brand px-1.5 py-0.5 text-[10px] font-bold uppercase text-black">Couverture</span>
                )}
                {isVideo && <Film className="absolute right-1 top-1 h-4 w-4 text-white drop-shadow" aria-hidden />}
              </button>
              {canWrite && (
                <div className="flex items-center justify-between px-1 py-1">
                  <Button variant="ghost" className="!min-h-8 !px-1.5" aria-label="Avancer" disabled={busy || i === 0} onClick={() => void move(i, i - 1)}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <ConfirmDialog
                    title="Supprimer ce média ?"
                    description={
                      items.length > 1
                        ? "Il disparaîtra du questionnaire. Les votes du restaurant sont conservés."
                        : "C'est le seul média de ce restaurant : il disparaîtra du vote."
                    }
                    onConfirm={() => void remove(d.id)}
                    trigger={
                      <Button variant="ghost" className="!min-h-8 !px-1.5" aria-label="Supprimer">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    }
                  />
                  <Button variant="ghost" className="!min-h-8 !px-1.5" aria-label="Reculer" disabled={busy || i === items.length - 1} onClick={() => void move(i, i + 1)}>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {error && (
        <p role="alert" className="mt-1 text-sm font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </section>
  );
}
