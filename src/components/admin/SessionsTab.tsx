"use client";

import { MapPin } from "lucide-react";
import { useMemo, useState } from "react";
import { withBase } from "@/lib/base-path";
import type { AdminAction, AdminSession, LoginFailure } from "@/lib/schema";
import { Badge, Button, Card, ConfirmDialog, Empty, fmtDate } from "./ui";
import { ClicksCard } from "./ClicksCard";
import { VisitsCard } from "./VisitsCard";

export type Journal = { sessions: AdminSession[]; actions: AdminAction[]; failures: { last24h: number; recent: LoginFailure[] } };

/** Navigateur et système lisibles, à partir de l'agent utilisateur. */
function device(ua: string | null) {
  if (!ua) return "Appareil inconnu";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Navigateur";
  return [browser, os].filter(Boolean).join(", ");
}

const place = (s: AdminSession) => [s.city, s.region, s.country].filter(Boolean).join(", ");

/** Journal des sessions du backoffice : qui s'est connecté (IP, position, appareil) et ce qu'il a fait ; révocation, échecs de connexion, purge. */
export function SessionsTab({ journal, tick, onChanged }: { journal: Journal; tick: number; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const bySession = useMemo(() => {
    const m = new Map<string, AdminAction[]>();
    for (const a of journal.actions) (m.get(a.session_id) ?? m.set(a.session_id, []).get(a.session_id)!).push(a);
    return m;
  }, [journal.actions]);

  const post = async (path: string) => {
    setBusy(true);
    try {
      await fetch(withBase(path), { method: "POST" });
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
    <VisitsCard tick={tick} />
    <ClicksCard tick={tick} />
    <Card
      title={`Échecs de connexion (24 h) : ${journal.failures.last24h}`}
      actions={
        <ConfirmDialog
          trigger={<Button disabled={busy}>Purger les données expirées</Button>}
          title="Purger les données expirées ?"
          description="Adresse IP, navigateur et appareil des réponses de plus de 30 jours effacés ; visites et clics de partage de plus de 90 jours, sessions du backoffice de plus de 180 jours et échecs de connexion de plus de 30 jours supprimés. Irréversible."
          confirmLabel="Purger"
          onConfirm={() => void post("/api/admin/purge")}
        />
      }
    >
      <p className="mb-3 text-sm text-muted dark:text-zinc-400">
        Après 10 échecs depuis la même adresse IP (ou 30 au total) en 15 minutes, la connexion est refusée pendant 15 minutes. Les 20 derniers échecs&nbsp;:
      </p>
      {journal.failures.recent.length === 0 ? (
        <Empty>Aucun échec de connexion enregistré.</Empty>
      ) : (
        <ul className="divide-y divide-line text-sm dark:divide-zinc-800">
          {journal.failures.recent.map((f) => (
            <li key={f.id} className="flex flex-wrap items-baseline gap-x-4 py-1.5">
              <span className="w-36 shrink-0 tabular-nums text-xs text-muted dark:text-zinc-400">{fmtDate(f.created_at)}</span>
              <span className="font-mono text-xs text-ink dark:text-zinc-200">{f.ip ?? "IP inconnue"}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
    <Card title={`Sessions du backoffice (${journal.sessions.length})`}>
      <p className="mb-4 text-sm text-muted dark:text-zinc-400">
        Une session par connexion : adresse IP, position approximative déduite de l&apos;IP (ville, région, pays), appareil, puis chaque action faite
        pendant la session. Les simples consultations ne sont pas journalisées. « Déconnecter » révoque la session&nbsp;: son jeton est refusé dès la requête suivante.
      </p>
      {journal.sessions.length === 0 ? (
        <Empty>Aucune session enregistrée.</Empty>
      ) : (
        <ul className="divide-y divide-line dark:divide-zinc-800">
          {journal.sessions.map((s) => {
            const actions = (bySession.get(s.id) ?? []).slice().sort((a, b) => a.created_at.localeCompare(b.created_at));
            const loc = place(s);
            return (
              <li key={s.id} className="py-3">
                <details className="group">
                  <summary className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span className="font-semibold text-ink dark:text-zinc-100">{fmtDate(s.created_at)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${s.role === "admin" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"}`}>
                      {s.role === "admin" ? "Lecture / écriture" : "Lecture seule"}
                    </span>
                    <span className="font-mono text-xs text-ink dark:text-zinc-200">{s.ip ?? "IP inconnue"}</span>
                    <span className="inline-flex items-center gap-1 text-muted dark:text-zinc-400">
                      <MapPin className="h-3.5 w-3.5" aria-hidden />
                      {loc || "Position inconnue"}
                      {s.latitude !== null && s.longitude !== null && (
                        <a
                          href={`https://www.openstreetmap.org/?mlat=${s.latitude}&mlon=${s.longitude}#map=12/${s.latitude}/${s.longitude}`}
                          target="_blank"
                          rel="noopener"
                          className="ml-1 underline hover:text-ink dark:hover:text-zinc-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          carte
                        </a>
                      )}
                    </span>
                    <span className="text-muted dark:text-zinc-400" title={s.user_agent ?? undefined}>{device(s.user_agent)}</span>
                    {s.revoked_at ? (
                      <Badge tone="warn" title={`Révoquée le ${fmtDate(s.revoked_at)}`}>Déconnectée</Badge>
                    ) : (
                      <span onClick={(e) => e.stopPropagation()}>
                        <ConfirmDialog
                          trigger={<Button variant="ghost" className="!min-h-7" disabled={busy} aria-label={`Déconnecter la session du ${fmtDate(s.created_at)}`}>Déconnecter cette session</Button>}
                          title="Déconnecter cette session ?"
                          description="Son jeton ne sera plus accepté : la personne devra se reconnecter avec le mot de passe. Si c'est la vôtre, vous serez déconnecté."
                          confirmLabel="Déconnecter"
                          onConfirm={() => void post(`/api/admin/sessions/${s.id}/revoke`)}
                        />
                      </span>
                    )}
                    <span className="ml-auto text-xs text-muted dark:text-zinc-400">
                      {actions.length} action{actions.length > 1 ? "s" : ""}, dernière à {fmtDate(s.last_seen_at)}
                    </span>
                  </summary>
                  <ol className="mt-2 space-y-1 border-l-2 border-line pl-4 text-sm dark:border-zinc-800">
                    {actions.map((a) => (
                      <li key={a.id} className="flex flex-wrap items-baseline gap-x-3">
                        <span className="w-36 shrink-0 tabular-nums text-xs text-muted dark:text-zinc-400">{fmtDate(a.created_at)}</span>
                        <span className="font-medium text-ink dark:text-zinc-100">{a.action}</span>
                        <span className="font-mono text-xs text-muted dark:text-zinc-400">
                          {a.method} {a.path}
                        </span>
                        {a.details !== null && a.details !== undefined && (
                          <code className="max-w-full truncate font-mono text-xs text-muted dark:text-zinc-400" title={JSON.stringify(a.details)}>
                            {JSON.stringify(a.details)}
                          </code>
                        )}
                      </li>
                    ))}
                  </ol>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
    </div>
  );
}
