"use client";

import { Bell } from "lucide-react";
import { Popover } from "radix-ui";
import { useEffect, useRef, useState } from "react";
import { withBase } from "@/lib/base-path";
import type { AttemptView } from "@/lib/fraud-review";
import { reasonLabel } from "@/lib/fraud-rules";
import { Button, fmtDate } from "./ui";

type Item = { kind: "suspect" | "fraud"; key: string; view: AttemptView; count: number };
type Notifications = { pending: number; highPriority: number; latest: Item[] };

const SEEN_KEY = "hw-admin-fraud-seen";
const readSeen = () => {
  try {
    return localStorage.getItem(SEEN_KEY) ?? "";
  } catch {
    return "";
  }
};

/**
 * Cloche de l'en-tête du backoffice : derniers votes suspects et frauduleux, état « vu » propre à chaque
 * navigateur d'admin (localStorage), message discret quand l'actualisation automatique en fait apparaître
 * de nouveaux. Le rôle lecture seule la voit aussi (aucune action ici).
 */
export function FraudNotifications({ tick, onOpenSecurity }: { tick: number; onOpenSecurity: () => void }) {
  const [data, setData] = useState<Notifications | null>(null);
  const [seen, setSeen] = useState("");
  const [fresh, setFresh] = useState(false);
  const known = useRef<Set<string> | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setSeen(readSeen()));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(withBase("/api/admin/fraud/notifications"), { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<Notifications>) : null))
      .then((d) => {
        if (cancelled || !d) return;
        const keys = new Set(d.latest.map((i) => i.key));
        if (known.current && [...keys].some((k) => !known.current!.has(k))) setFresh(true);
        known.current = keys;
        setData(d);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const unseen = data?.latest.filter((i) => i.view.at > seen).length ?? 0;
  const markSeen = () => {
    const last = data?.latest[0]?.view.at ?? new Date().toISOString();
    try {
      localStorage.setItem(SEEN_KEY, last);
    } catch {
      /* état « vu » pour cette visite seulement */
    }
    setSeen(last);
    setFresh(false);
  };

  return (
    <>
      <span aria-live="polite" className="text-xs font-semibold text-amber-600 dark:text-amber-300">
        {fresh ? "Nouveaux votes à examiner" : ""}
      </span>
      <Popover.Root onOpenChange={(o) => o && markSeen()}>
        <Popover.Trigger asChild>
          <Button variant="ghost" aria-label={`Notifications anti-fraude${unseen ? ` : ${unseen} nouvelle(s)` : ""}`} className="relative">
            <Bell className="h-4 w-4" aria-hidden />
            {unseen > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white" aria-hidden>
                {unseen}
              </span>
            )}
          </Button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content align="end" sideOffset={8} className="z-50 w-80 rounded-xl border border-line bg-white p-3 text-sm shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
            <p className="font-semibold text-ink dark:text-zinc-100">
              {data ? `${data.pending} vote(s) en attente${data.highPriority ? `, dont ${data.highPriority} en priorité haute` : ""}` : "Chargement…"}
            </p>
            <ul className="mt-2 max-h-80 divide-y divide-line overflow-y-auto dark:divide-zinc-800">
              {(data?.latest ?? []).map((i) => (
                <li key={`${i.kind}-${i.key}`} className="py-2">
                  <p className="text-xs font-semibold text-ink dark:text-zinc-100">
                    {i.kind === "fraud" ? `Frauduleux${i.count > 1 ? ` (${i.count} tentatives)` : ""}` : i.view.priority ? "Suspect, priorité haute" : "Suspect, en attente"}
                    <span className="ml-1 font-normal text-muted">{fmtDate(i.view.at)}</span>
                  </p>
                  <p className="text-xs text-muted dark:text-zinc-400">{i.view.reasons.map(reasonLabel).join(", ") || "Aucune règle"}</p>
                </li>
              ))}
              {data && data.latest.length === 0 && <li className="py-2 text-xs text-muted">Rien à signaler.</li>}
            </ul>
            <Button className="mt-2 w-full" onClick={onOpenSecurity}>
              Ouvrir l&apos;onglet Sécurité
            </Button>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </>
  );
}
