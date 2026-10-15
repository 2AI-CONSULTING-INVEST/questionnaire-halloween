"use client";

import { Search } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { pseudoKey } from "@/lib/schema";

const PAGE = 200;

/**
 * Liste des pseudos : recherche instantanée (insensible à la casse et aux accents) et affichage
 * par paquets de 200 pour rester fluide avec des milliers de participants.
 */
export function ParticipantsList({ participants }: { participants: { id: string; pseudo: string }[] }) {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const deferred = useDeferredValue(query);
  const needle = pseudoKey(deferred);
  const filtered = useMemo(() => (needle ? participants.filter((p) => pseudoKey(p.pseudo).includes(needle)) : participants), [participants, needle]);
  const shown = filtered.slice(0, limit);

  if (participants.length === 0) {
    return <p className="py-6 text-center text-base text-fg-muted">Aucun participant pour l&apos;instant : soyez le premier à vous inscrire en votant 🎃</p>;
  }

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(PAGE);
          }}
          placeholder="Rechercher un pseudonyme"
          aria-label="Rechercher un pseudonyme"
          className="min-h-11 w-full rounded-full border border-edge-strong bg-surface pl-10 pr-4 text-base text-fg outline-none transition-colors placeholder:text-placeholder focus:border-brand focus:ring-2 focus:ring-brand/40"
        />
      </div>
      <p className="mt-3 text-xs text-fg-muted" aria-live="polite">
        {needle
          ? `${filtered.length.toLocaleString("fr-FR")} résultat${filtered.length > 1 ? "s" : ""}`
          : `${participants.length.toLocaleString("fr-FR")} participant${participants.length > 1 ? "s" : ""}`}
      </p>
      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-fg-muted">Aucun pseudonyme ne correspond à « {deferred.trim()} ».</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2">
          {shown.map((p) => (
            <li key={p.id} className="max-w-full truncate rounded-full border border-edge bg-page/60 px-3 py-1.5 text-sm font-medium text-fg">
              {p.pseudo}
            </li>
          ))}
        </ul>
      )}
      {filtered.length > limit && (
        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => setLimit((l) => l + PAGE)}
            className="inline-flex min-h-11 items-center rounded-full border border-edge-strong bg-surface px-5 text-sm font-semibold text-fg transition-colors hover:bg-surface-2"
          >
            Afficher plus ({(filtered.length - limit).toLocaleString("fr-FR")} restants)
          </button>
        </div>
      )}
    </div>
  );
}
