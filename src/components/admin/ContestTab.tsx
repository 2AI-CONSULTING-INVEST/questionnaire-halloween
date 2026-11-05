"use client";

import { AlertTriangle, ExternalLink, Flag, Loader2, RotateCcw, Save, Trash2, Upload } from "lucide-react";
import { Label } from "radix-ui";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Contest } from "@/lib/contest";
import { withBase } from "@/lib/base-path";
import { posterOf } from "@/lib/schema";
import { optimizedPoster } from "../media/poster";
import { VideoPlayer } from "../media/VideoPlayer";
import { prepareMedia, storeMedia } from "./upload";
import type { CompressStep } from "./video-compress";
import { Badge, Button, Card, ConfirmDialog, fmtDate, inputClass } from "./ui";

type FieldErrors = Partial<Record<"instagram_url" | "tiktok_url", string>>;
class PatchError extends Error {
  constructor(message: string, readonly fields: FieldErrors = {}) {
    super(message);
  }
}

async function patchContest(body: Partial<Pick<Contest, "closed" | "instagram_url" | "tiktok_url" | "video_url">>): Promise<Contest> {
  const res = await fetch(withBase("/api/admin/contest"), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as Contest & { error?: string; details?: Record<string, string[]> };
  if (!res.ok) {
    const fields: FieldErrors = {};
    for (const k of ["instagram_url", "tiktok_url"] as const) if (data.details?.[k]?.[0]) fields[k] = data.details[k][0];
    throw new PatchError(data.error ?? `Erreur ${res.status}`, fields);
  }
  return data;
}

/**
 * Onglet « Concours » : fin (ou réouverture) du concours, liens des posts du tirage au sort et
 * vidéo du tirage, affichés sur l'accueil et la page du tirage une fois le concours terminé.
 */
export function ContestTab({ canWrite }: { canWrite: boolean }) {
  const [contest, setContest] = useState<Contest | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(withBase("/api/admin/contest"), { cache: "no-store" });
      if (!res.ok) throw new Error("load");
      setContest(await res.json());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);
  useEffect(() => {
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, [load]);

  if (!contest) {
    return <p className="py-8 text-center text-sm text-muted dark:text-zinc-400">{failed ? "⚠️ Chargement impossible, actualisez la page." : "Chargement…"}</p>;
  }
  return (
    <div className="flex flex-col gap-6">
      <StatusCard contest={contest} canWrite={canWrite} onSaved={setContest} />
      <PostsCard contest={contest} canWrite={canWrite} onSaved={setContest} />
      <VideoCard contest={contest} canWrite={canWrite} onSaved={setContest} />
    </div>
  );
}

type CardProps = { contest: Contest; canWrite: boolean; onSaved: (c: Contest) => void };

function StatusCard({ contest, canWrite, onSaved }: CardProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async (closed: boolean) => {
    setBusy(true);
    setError(null);
    try {
      onSaved(await patchContest({ closed }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title="État du concours"
      actions={contest.closed ? <Badge tone="danger">Terminé</Badge> : <Badge tone="ok">En cours</Badge>}
    >
      {contest.closed ? (
        <p className="text-sm text-muted dark:text-zinc-400">
          Terminé le <strong className="text-ink dark:text-zinc-100">{fmtDate(contest.closed_at)}</strong>. Plus aucun vote, commentaire ni inscription au
          tirage n&apos;est accepté&nbsp;; la liste des participants est figée. L&apos;accueil annonce la fin du concours, avec «&nbsp;Le Chamas Gagnant est...&nbsp;» (la
          crypte) et les résultats du tirage ci-dessous.
        </p>
      ) : (
        <p className="text-sm text-muted dark:text-zinc-400">
          Le questionnaire est ouvert&nbsp;: votes, commentaires et inscriptions au tirage au sort sont acceptés.
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {canWrite &&
          (contest.closed ? (
            <ConfirmDialog
              title="Rouvrir le concours ?"
              description="Le questionnaire revient sur l'accueil : les votes, les commentaires et les inscriptions au tirage reprennent immédiatement pour tout le monde."
              confirmLabel="Rouvrir le concours"
              onConfirm={() => void toggle(false)}
              trigger={
                <Button disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RotateCcw className="h-4 w-4" aria-hidden />} Rouvrir le concours
                </Button>
              }
            />
          ) : (
            <ConfirmDialog
              title="Mettre fin au concours ?"
              description="Les votes, les commentaires et les inscriptions au tirage au sort s'arrêtent immédiatement pour tout le monde, et l'accueil annonce la fin du concours. Vous pourrez le rouvrir plus tard (édition suivante)."
              confirmLabel="Mettre fin au concours"
              onConfirm={() => void toggle(true)}
              trigger={
                <Button variant="danger" disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Flag className="h-4 w-4" aria-hidden />} Mettre fin au concours
                </Button>
              }
            />
          ))}
        <a href={withBase("/")} target="_blank" rel="noopener" className="inline-flex min-h-9 items-center gap-1 rounded-lg px-3 text-sm font-semibold text-muted hover:bg-gray-100 hover:text-ink dark:text-zinc-400 dark:hover:bg-zinc-800">
          Voir l&apos;accueil <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </Card>
  );
}

function PostsCard({ contest, canWrite, onSaved }: CardProps) {
  const [instagram, setInstagram] = useState(contest.instagram_url ?? "");
  const [tiktok, setTiktok] = useState(contest.tiktok_url ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<FieldErrors>({});
  const dirty = instagram.trim() !== (contest.instagram_url ?? "") || tiktok.trim() !== (contest.tiktok_url ?? "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    setSaved(false);
    try {
      const next = await patchContest({ instagram_url: instagram.trim() || null, tiktok_url: tiktok.trim() || null });
      setInstagram(next.instagram_url ?? "");
      setTiktok(next.tiktok_url ?? "");
      onSaved(next);
      setSaved(true);
    } catch (err) {
      if (err instanceof PatchError && Object.keys(err.fields).length) setFields(err.fields);
      else setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  const field = (id: "instagram_url" | "tiktok_url", label: string, value: string, set: (v: string) => void, placeholder: string) => (
    <div className="flex flex-col gap-1">
      <Label.Root htmlFor={`contest-${id}`} className="text-xs font-semibold text-muted dark:text-zinc-400">
        {label}
      </Label.Root>
      <input
        id={`contest-${id}`}
        type="url"
        inputMode="url"
        value={value}
        disabled={!canWrite}
        maxLength={500}
        onChange={(e) => {
          set(e.target.value);
          setSaved(false);
        }}
        placeholder={placeholder}
        aria-invalid={!!fields[id]}
        aria-describedby={fields[id] ? `contest-${id}-error` : undefined}
        className={`${inputClass} w-full`}
      />
      {fields[id] && (
        <p id={`contest-${id}-error`} className="text-xs font-medium text-red-600 dark:text-red-400">
          {fields[id]}
        </p>
      )}
    </div>
  );

  return (
    <Card title="Publications du tirage au sort">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-sm text-muted dark:text-zinc-400">
          Liens vers les posts qui annoncent les gagnants. Ils apparaissent sur l&apos;accueil et sur la page du tirage une fois le concours terminé. Laissez vide
          un réseau sans publication.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {field("instagram_url", "Post Instagram", instagram, setInstagram, "https://www.instagram.com/p/…")}
          {field("tiktok_url", "Vidéo TikTok", tiktok, setTiktok, "https://www.tiktok.com/@chamastacos_lille/video/…")}
        </div>
        {canWrite && (
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="primary" disabled={busy || !dirty}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />} Enregistrer les liens
            </Button>
            {saved && !dirty && (
              <span role="status" className="text-sm font-medium text-success">
                Enregistré
              </span>
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </form>
    </Card>
  );
}

const STEP_LABEL: Record<CompressStep, string> = { analyse: "Analyse…", compression: "Compression", verification: "Vérification…" };

type UploadState =
  | { status: "idle" }
  | { status: "preparing"; step?: CompressStep; progress: number }
  | { status: "uploading"; progress: number; summary?: string; warning?: string }
  | { status: "done"; summary?: string; warning?: string }
  | { status: "error"; message: string };

function VideoCard({ contest, canWrite, onSaved }: CardProps) {
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<UploadState>({ status: "idle" });
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const skip = useRef<AbortController | null>(null);
  const busy = state.status === "preparing" || state.status === "uploading" || removing;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setRemoveError(null);
    setState({ status: "preparing", progress: 0 });
    try {
      const ctrl = new AbortController();
      skip.current = ctrl;
      const media = await prepareMedia(file, { signal: ctrl.signal, onStep: (step, p) => setState({ status: "preparing", step, progress: p ?? 0 }) }).finally(
        () => (skip.current = null),
      );
      if (media.kind !== "video") throw new Error("Choisissez une vidéo (MP4, MOV ou WebM).");
      const info = { summary: media.summary, warning: media.warning };
      setState({ status: "uploading", progress: 0, ...info });
      let url = await storeMedia(media, (progress) => setState({ status: "uploading", progress, ...info }));
      if (url === null) {
        // Stockage local (développement) : le fichier passe par le serveur.
        const form = new FormData();
        form.set("media", new File([media.file], `media.${media.type.split("/")[1]}`, { type: media.type }));
        if (media.poster) form.set("poster", new File([media.poster], "poster.jpg", { type: "image/jpeg" }));
        const res = await fetch(withBase("/api/admin/contest"), { method: "POST", body: form });
        const body = (await res.json().catch(() => ({}))) as { video_url?: string; error?: string };
        if (!res.ok || !body.video_url) throw new Error(body.error ?? "Échec de l'envoi");
        url = body.video_url;
      }
      onSaved(await patchContest({ video_url: url }));
      setState({ status: "done", ...info });
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : "Échec de l'envoi" });
    }
  }

  async function remove() {
    setRemoving(true);
    setRemoveError(null);
    try {
      onSaved(await patchContest({ video_url: null }));
      setState({ status: "idle" });
    } catch (e) {
      setRemoveError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setRemoving(false);
    }
  }

  const statusText =
    state.status === "preparing"
      ? state.step
        ? state.step === "compression"
          ? `Compression ${Math.round(state.progress * 100)} %`
          : STEP_LABEL[state.step]
        : "Préparation…"
      : state.status === "uploading"
        ? `Envoi ${Math.round(state.progress * 100)} %`
        : null;

  return (
    <Card title="Vidéo du tirage au sort">
      <div className="flex flex-col gap-5 md:flex-row md:items-start">
        <div className="flex aspect-video w-full shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black md:w-80">
          {contest.video_url ? (
            // Aperçu : rien n'est téléchargé avant la lecture.
            <VideoPlayer key={contest.video_url} src={contest.video_url} poster={optimizedPoster(posterOf(contest.video_url), 320)} label="Aperçu de la vidéo du tirage" />
          ) : (
            <p className="px-4 text-center text-sm text-zinc-400">Aucune vidéo pour l&apos;instant</p>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted dark:text-zinc-400">
            Affichée dans une fenêtre de lecture sur l&apos;accueil et la page du tirage, une fois le concours terminé. MP4 (H.264) conseillé, 50 Mo max après
            compression&nbsp;: les visiteurs ne la téléchargent que s&apos;ils appuient sur lecture.
          </p>
          {canWrite && (
            <form onSubmit={submit} className="mt-4 flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <Label.Root htmlFor="contest-video" className="text-xs font-semibold text-muted dark:text-zinc-400">
                  {contest.video_url ? "Remplacer la vidéo" : "Ajouter la vidéo"}
                </Label.Root>
                <input
                  id="contest-video"
                  ref={fileRef}
                  type="file"
                  required
                  disabled={busy}
                  accept="video/mp4,video/quicktime,video/webm,.mov"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-ink"
                />
              </div>
              <Button type="submit" variant="primary" disabled={busy || !file}>
                {state.status === "preparing" || state.status === "uploading" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="h-4 w-4" aria-hidden />}
                Envoyer
              </Button>
              {contest.video_url && (
                <ConfirmDialog
                  title="Retirer la vidéo du tirage ?"
                  description="Elle disparaît de l'accueil et de la page du tirage, et le fichier est supprimé du stockage."
                  confirmLabel="Retirer"
                  onConfirm={() => void remove()}
                  trigger={
                    <Button variant="ghost" disabled={busy}>
                      {removing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />} Retirer
                    </Button>
                  }
                />
              )}
            </form>
          )}

          <div aria-live="polite">
            {statusText && (
              <div className="mt-4">
                <div className="flex items-center gap-2 text-sm text-muted dark:text-zinc-400">
                  <span className="flex-1">{statusText}</span>
                  {state.status === "preparing" && state.step && (
                    <Button variant="ghost" className="min-h-7 px-2 text-xs" onClick={() => skip.current?.abort()}>
                      Passer la compression
                    </Button>
                  )}
                </div>
                {(state.status === "uploading" || (state.status === "preparing" && state.step === "compression")) && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-zinc-800">
                    <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${state.progress * 100}%` }} />
                  </div>
                )}
              </div>
            )}
            {state.status === "done" && <p className="mt-3 text-sm font-medium text-success">Vidéo en ligne.</p>}
            {(state.status === "uploading" || state.status === "done") && state.summary && <p className="mt-1.5 text-xs text-muted dark:text-zinc-400">{state.summary}</p>}
            {(state.status === "uploading" || state.status === "done") && state.warning && (
              <p className="mt-1.5 flex gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> {state.warning}
              </p>
            )}
            {state.status === "error" && (
              <p role="alert" className="mt-3 flex gap-1.5 text-sm font-medium text-red-600 dark:text-red-400">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {state.message}
              </p>
            )}
            {removeError && (
              <p role="alert" className="mt-3 text-sm font-medium text-red-600 dark:text-red-400">
                {removeError}
              </p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
