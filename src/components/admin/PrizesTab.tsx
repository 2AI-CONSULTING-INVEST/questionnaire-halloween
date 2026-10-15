"use client";

import Image from "next/image";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { Label } from "radix-ui";
import { useRef, useState } from "react";
import { isLocalMedia, PRIZE_DESCRIPTION_MAX, type Participant, type Prize } from "@/lib/schema";
import { createPrize, prepareImageOnly, replacePrizeImage } from "./upload";
import { Button, Card, ConfirmDialog, Empty, inputClass } from "./ui";
import { withBase } from "@/lib/base-path";

async function patchPrize(id: string, body: unknown) {
  const res = await fetch(withBase(`/api/prizes/${id}`), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) {
    const b = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(b.error ?? "Modification impossible");
  }
}

export function PrizesTab({
  prizes,
  participants,
  canWrite,
  onChanged,
}: {
  prizes: Prize[];
  participants: Participant[];
  canWrite: boolean;
  onChanged: () => void;
}) {
  const pseudoOf = new Map(participants.map((p) => [p.id, p.pseudo]));
  return (
    <div className="flex flex-col gap-6">
      {canWrite && <NewPrizeCard onChanged={onChanged} />}
      <Card title={`Lots à gagner (${prizes.length})`}>
        {prizes.length === 0 ? (
          <Empty>Aucun lot. La page publique affiche « Les lots seront dévoilés très bientôt ».</Empty>
        ) : (
          <ul className="flex flex-col gap-4">
            {prizes.map((p, i) => (
              <PrizeRow key={p.id} prize={p} index={i} prizes={prizes} winner={p.winner_participant_id ? pseudoOf.get(p.winner_participant_id) ?? null : null} canWrite={canWrite} onChanged={onChanged} />
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-muted dark:text-zinc-400">
          Un lot a au plus un gagnant&nbsp;: pour plusieurs exemplaires, créez plusieurs lots. L&apos;attribution se fait dans l&apos;onglet « Participants ».
        </p>
      </Card>
    </div>
  );
}

function NewPrizeCard({ onChanged }: { onChanged: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setProgress(0);
    try {
      const image = file ? await prepareImageOnly(file) : null;
      await createPrize({ name: name.trim(), description: description.trim() }, image, setProgress);
      setName("");
      setDescription("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de la création");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Ajouter un lot">
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <div className="flex flex-col gap-1">
          <Label.Root htmlFor="prize-name" className="text-xs font-semibold text-muted dark:text-zinc-400">
            Nom du lot
          </Label.Root>
          <input id="prize-name" required minLength={2} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Un menu Chamas Tacos offert" className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <Label.Root htmlFor="prize-image" className="text-xs font-semibold text-muted dark:text-zinc-400">
            Photo (optionnelle)
          </Label.Root>
          <input
            id="prize-image"
            ref={fileRef}
            type="file"
            accept="image/*,.heic,.heif"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-ink"
          />
        </div>
        <Button type="submit" variant="primary" disabled={busy || name.trim().length < 2}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
          {busy ? (progress > 0 && progress < 1 ? `${Math.round(progress * 100)} %` : "Ajout…") : "Ajouter"}
        </Button>
        <div className="flex flex-col gap-1 md:col-span-3">
          <Label.Root htmlFor="prize-description" className="text-xs font-semibold text-muted dark:text-zinc-400">
            Description (optionnelle, {PRIZE_DESCRIPTION_MAX} caractères max)
          </Label.Root>
          <textarea id="prize-description" rows={2} maxLength={PRIZE_DESCRIPTION_MAX} value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputClass} py-2`} />
        </div>
        {error && (
          <p role="alert" className="text-sm font-medium text-red-600 md:col-span-3 dark:text-red-400">
            {error}
          </p>
        )}
      </form>
    </Card>
  );
}

function PrizeRow({
  prize,
  index,
  prizes,
  winner,
  canWrite,
  onChanged,
}: {
  prize: Prize;
  index: number;
  prizes: Prize[];
  winner: string | null;
  canWrite: boolean;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(prize.name);
  const [description, setDescription] = useState(prize.description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  /** Échange l'ordre avec le voisin, puis renumérote (valeurs croissantes). */
  const move = (to: number) =>
    run(async () => {
      if (to < 0 || to >= prizes.length) return;
      const orders = prizes.map((p) => p.display_order).sort((a, b) => a - b);
      for (let i = 1; i < orders.length; i++) if (orders[i] <= orders[i - 1]) orders[i] = orders[i - 1] + 1;
      const next = [...prizes];
      [next[index], next[to]] = [next[to], next[index]];
      await Promise.all(next.map((p, i) => (p.display_order === orders[i] ? null : patchPrize(p.id, { display_order: orders[i] }))));
    });

  const save = () =>
    run(async () => {
      await patchPrize(prize.id, { name: name.trim(), description: description.trim() });
      setEditing(false);
    });

  const replaceImage = (file: File) =>
    run(async () => {
      await replacePrizeImage(prize.id, await prepareImageOnly(file), () => undefined);
      if (fileRef.current) fileRef.current.value = "";
    });

  const remove = () =>
    run(async () => {
      const res = await fetch(withBase(`/api/prizes/${prize.id}`), { method: "DELETE" });
      if (!res.ok) throw new Error("Suppression impossible");
    });

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-line p-3 sm:flex-row sm:items-start dark:border-zinc-800">
      <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-md bg-gray-100 sm:w-36 dark:bg-zinc-800">
        {prize.image_url ? (
          <Image src={prize.image_url} alt="" fill sizes="144px" unoptimized={isLocalMedia(prize.image_url)} className="object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-3xl" aria-hidden>
            🎁
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="flex flex-col gap-2">
            <input aria-label="Nom du lot" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} className={`${inputClass} w-full`} />
            <textarea aria-label="Description" rows={2} value={description} maxLength={PRIZE_DESCRIPTION_MAX} onChange={(e) => setDescription(e.target.value)} className={`${inputClass} w-full py-2`} />
            <div className="flex gap-2">
              <Button variant="primary" disabled={busy || name.trim().length < 2} onClick={() => void save()}>
                Enregistrer
              </Button>
              <Button disabled={busy} onClick={() => (setEditing(false), setName(prize.name), setDescription(prize.description ?? ""))}>
                <X className="h-4 w-4" aria-hidden /> Annuler
              </Button>
            </div>
          </div>
        ) : (
          <>
            <h3 className="text-sm font-semibold text-ink dark:text-zinc-100">
              <span className="mr-2 text-xs text-muted">#{index + 1}</span>
              {prize.name}
            </h3>
            {prize.description && <p className="mt-1 whitespace-pre-line text-sm text-muted dark:text-zinc-400">{prize.description}</p>}
            <p className="mt-2 text-xs font-semibold">
              {winner ? <span className="rounded bg-brand-50 px-1.5 py-0.5 text-ink dark:bg-yellow-900/30 dark:text-yellow-200">🏆 Gagné par {winner}</span> : <span className="text-muted dark:text-zinc-400">Pas encore attribué</span>}
            </p>
          </>
        )}
        {error && (
          <p role="alert" className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
      {canWrite && !editing && (
        <div className="flex flex-wrap items-center gap-1 sm:flex-col sm:items-end">
          <div className="flex gap-1">
            <Button variant="ghost" className="!min-h-8 !px-1.5" aria-label="Monter" disabled={busy || index === 0} onClick={() => void move(index - 1)}>
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button variant="ghost" className="!min-h-8 !px-1.5" aria-label="Descendre" disabled={busy || index === prizes.length - 1} onClick={() => void move(index + 1)}>
              <ArrowDown className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="ghost" className="!min-h-8" disabled={busy} onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" aria-hidden /> Modifier
          </Button>
          <label className={`inline-flex min-h-8 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm font-semibold text-muted hover:bg-gray-100 hover:text-ink dark:text-zinc-400 dark:hover:bg-zinc-800 ${busy ? "pointer-events-none opacity-50" : ""}`}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ImagePlus className="h-4 w-4" aria-hidden />}
            {prize.image_url ? "Remplacer l'image" : "Ajouter une image"}
            <input ref={fileRef} type="file" accept="image/*,.heic,.heif" className="sr-only" onChange={(e) => e.target.files?.[0] && void replaceImage(e.target.files[0])} />
          </label>
          <ConfirmDialog
            title={`Supprimer « ${prize.name} » ?`}
            description="Le lot et son image disparaîtront de la page publique. Son éventuel gagnant n'est pas supprimé."
            onConfirm={() => void remove()}
            trigger={
              <Button variant="ghost" className="!min-h-8" aria-label={`Supprimer ${prize.name}`} disabled={busy}>
                <Trash2 className="h-4 w-4" aria-hidden /> Supprimer
              </Button>
            }
          />
        </div>
      )}
    </li>
  );
}
