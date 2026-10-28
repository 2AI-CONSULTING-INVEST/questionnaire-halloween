"use client";

import { useEffect, useMemo, useState } from "react";
import { withBase } from "@/lib/base-path";
import { FRAUD_RULES } from "@/lib/fraud-rules";
import type { RiskSettings, SecuritySummary, TopEntry } from "@/lib/risk";
import { shortName, type Decoration } from "@/lib/schema";
import { DeviceTestPanel, FraudPersons, GroupsView, PendingVotes, SHOW_GROUP_EVENT } from "./FraudReview";
import { RiskMethodology } from "./RiskMethodology";
import { Button, Card, Empty, inputClass } from "./ui";

function Stat({ label, value, tone = "" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg border border-line p-3 dark:border-zinc-800">
      <p className="text-xs font-semibold text-muted dark:text-zinc-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${tone || "text-ink dark:text-zinc-100"}`}>{value.toLocaleString("fr-FR")}</p>
    </div>
  );
}

function Counts({ title, c }: { title: string; c: SecuritySummary["today"] }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-ink dark:text-zinc-100">{title}</h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Comptés" value={c.counted} />
        <Stat label="En attente" value={c.held} tone="text-amber-600 dark:text-amber-300" />
        <Stat label="Bloqués" value={c.blocked} tone="text-red-600 dark:text-red-300" />
        <Stat label="Exclus automatiquement" value={c.autoExcluded} tone="text-red-600 dark:text-red-300" />
        <Stat label="Exclus à la main" value={c.adminExcluded} />
      </div>
    </div>
  );
}

/** Interrupteurs des règles (réglages `riskSettingsSchema`), dans l'ordre de la méthodologie. */
const SWITCHES: { key: keyof RiskSettings; rule: keyof typeof FRAUD_RULES; label: string }[] = [
  { key: "b2_strong_key", rule: "B2", label: "B2 : refuser une clé forte déjà vue aujourd'hui avec un second indice (sinon H4)" },
  { key: "b4_cross_browser", rule: "B4", label: "B4 : refuser le même ordinateur depuis un autre navigateur, même réseau (téléphone : H10, attente)" },
  { key: "b4_strict_any_network", rule: "B4", label: "B4 sur tout réseau : refuser aussi la clé stricte (polices) depuis un autre réseau, 4G ou VPN (sinon H10, attente)" },
  { key: "h2_anonymous_ip", rule: "H2", label: "H2 : mettre en attente les IP Tor et hébergeurs" },
  { key: "h3_foreign_country", rule: "H3", label: "H3 : mettre en attente les IP hors de France" },
  { key: "h4_strong_seen", rule: "H4", label: "H4 : clé forte déjà vue, quand B2 est désactivé" },
  { key: "h5_weak_network", rule: "H5", label: "H5 : clé faible déjà vue sur le même réseau" },
  { key: "h6_private_seen", rule: "H6", label: "H6 : navigation privée et clé déjà vue" },
  { key: "h7_recidivism", rule: "H7", label: "H7 : récidive d'un groupe confirmé" },
  { key: "h9_weak_nearby", rule: "H9", label: "H9 : clé faible, même ville, même décoration, peu après" },
];

/** Réglages : mode, seuils, plafond par IP, interrupteurs des règles ; modifiables par un compte en écriture seulement. */
function SettingsForm({ settings, canWrite, onSaved }: { settings: RiskSettings; canWrite: boolean; onSaved: () => void }) {
  const [form, setForm] = useState(settings);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(withBase("/api/admin/settings"), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const body = (await res.json().catch(() => ({}))) as { error?: string; details?: Record<string, string[]> };
      if (!res.ok) throw new Error(Object.values(body.details ?? {}).flat()[0] ?? body.error ?? "Enregistrement impossible");
      setMessage({ ok: true, text: "Réglages enregistrés." });
      onSaved();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "Erreur" });
    } finally {
      setBusy(false);
    }
  }

  const num = (key: "flag_threshold" | "block_threshold" | "ip_daily_max" | "h9_minutes" | "c2_min_attempts") => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: Number(e.target.value) });
  const field = "flex flex-col gap-1 text-xs font-semibold text-muted dark:text-zinc-400";
  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className={`${field} w-full min-w-0 max-w-full sm:w-auto`}>
          Mode
          <select value={form.mode} disabled={!canWrite} onChange={(e) => setForm({ ...form, mode: e.target.value as RiskSettings["mode"] })} className={`${inputClass} w-full min-w-0 max-w-full`}>
            <option value="block">Blocage (refus, attente, exclusion)</option>
            <option value="observe">Observation (rien n&apos;est retenu)</option>
          </select>
        </label>
        <label className={field}>
          Seuil de signalement (attente)
          <input type="number" min={0} max={200} value={form.flag_threshold} disabled={!canWrite} onChange={num("flag_threshold")} className={`${inputClass} w-28`} />
        </label>
        <label className={field}>
          Seuil de blocage
          <input type="number" min={0} max={200} value={form.block_threshold} disabled={!canWrite} onChange={num("block_threshold")} className={`${inputClass} w-28`} />
        </label>
        <label className={field} title="Wi-Fi d'un restaurant : plusieurs clients partagent une IP, laissez une marge">
          Votes validés max. par IP et par jour (0 = sans limite)
          <input type="number" min={0} max={1000} value={form.ip_daily_max} disabled={!canWrite} onChange={num("ip_daily_max")} className={`${inputClass} w-28`} />
        </label>
        <label className={field}>
          Délai de H9 (minutes)
          <input type="number" min={1} max={120} value={form.h9_minutes} disabled={!canWrite} onChange={num("h9_minutes")} className={`${inputClass} w-28`} />
        </label>
        <label className={field}>
          C2 : cookies distincts d&apos;une clé forte qui confirment un groupe
          <input type="number" min={2} max={20} value={form.c2_min_attempts} disabled={!canWrite} onChange={num("c2_min_attempts")} className={`${inputClass} w-28`} />
        </label>
      </div>
      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="mb-1 text-xs font-semibold text-muted dark:text-zinc-400">Règles</legend>
        {SWITCHES.map((s) => (
          <label key={s.key} className="flex items-start gap-2 text-sm text-ink dark:text-zinc-200" title={FRAUD_RULES[s.rule].why}>
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-[var(--color-brand)]"
              checked={form[s.key] as boolean}
              disabled={!canWrite}
              onChange={(e) => setForm({ ...form, [s.key]: e.target.checked })}
            />
            {s.label}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        {canWrite && (
          <Button type="submit" variant="primary" disabled={busy || form.flag_threshold >= form.block_threshold}>
            Enregistrer
          </Button>
        )}
        {message && (
          <p role={message.ok ? "status" : "alert"} className={`text-sm font-medium ${message.ok ? "text-success" : "text-red-600 dark:text-red-400"}`}>
            {message.text}
          </p>
        )}
      </div>
    </form>
  );
}

function TopList({ title, entries }: { title: string; entries: TopEntry[] }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-ink dark:text-zinc-100">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-sm text-muted dark:text-zinc-400">Rien aujourd&apos;hui.</p>
      ) : (
        <ol className="divide-y divide-line text-sm dark:divide-zinc-800">
          {entries.map((e) => (
            <li key={e.key} className="flex items-center justify-between gap-3 py-1.5">
              <span className="font-mono text-xs text-ink dark:text-zinc-200">{e.key}</span>
              <span className="whitespace-nowrap tabular-nums text-muted dark:text-zinc-400">
                {e.votes} compté{e.votes > 1 ? "s" : ""}
                {e.held > 0 && <span className="ml-1 text-amber-600 dark:text-amber-300">, {e.held} en attente</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/**
 * Onglet Sécurité : compteurs, réglages, votes suspects en attente, votes frauduleux (par personne),
 * groupes du moteur et Recalculer, test de l'appareil, méthodologie. Le rôle lecture seule voit tout,
 * sans aucune action, et sans les champs sensibles (masqués côté serveur).
 */
export function SecurityTab({ summary, decorations, canWrite, tick, onChanged }: { summary: SecuritySummary | null; decorations: Decoration[]; canWrite: boolean; tick: number; onChanged: () => void }) {
  const decoMap = useMemo(() => new Map(decorations.map((d) => [d.id, d.restaurant_name])), [decorations]);
  const decoName = (id: string | null) => (id ? shortName(decoMap.get(id) ?? "(supprimée)") : "sans vote");
  const [day, setDay] = useState(() => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" }));
  useEffect(() => {
    const show = (e: Event) => setDay((e as CustomEvent<string>).detail);
    window.addEventListener(SHOW_GROUP_EVENT, show);
    return () => window.removeEventListener(SHOW_GROUP_EVENT, show);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <Card title="Anti-fraude : un vote par personne et par jour">
        <p className="mb-4 text-sm text-muted dark:text-zinc-400">
          Les cas sûrs sont bloqués (modale « Votre vote est bloqué »), les cas suspects sont mis en attente sans rien dire au votant, et le moteur de groupes exclut
          après coup les votes en trop d&apos;une même personne. Faire compter un vote demande la double validation. La méthode complète est expliquée plus bas.
        </p>
        {summary ? (
          <div className="flex flex-col gap-5">
            <Counts title="Aujourd'hui (heure de Paris)" c={summary.today} />
            <Counts title="Depuis le début" c={summary.total} />
            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink dark:text-zinc-100">Réglages</h3>
              {/* `key` : le formulaire repart des réglages enregistrés à chaque actualisation. */}
              <SettingsForm key={JSON.stringify(summary.settings)} settings={summary.settings} canWrite={canWrite} onSaved={onChanged} />
            </div>
          </div>
        ) : (
          <Empty>Chargement…</Empty>
        )}
      </Card>

      <PendingVotes tick={tick} decoName={decoName} canWrite={canWrite} onChanged={onChanged} />
      <FraudPersons tick={tick} decoName={decoName} canWrite={canWrite} onChanged={onChanged} onShowDay={setDay} />
      <GroupsView day={day} setDay={setDay} tick={tick} decoName={decoName} canWrite={canWrite} onChanged={onChanged} />
      <DeviceTestPanel />

      {summary && <RiskMethodology settings={summary.settings} />}

      {summary && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Aujourd'hui : top 10 des adresses IP">
            <TopList title="Votes par adresse IP" entries={summary.topIps} />
          </Card>
          <Card title="Aujourd'hui : top 10 des appareils">
            <TopList title="Votes par clé matérielle (8 premiers caractères)" entries={summary.topDevices} />
          </Card>
        </div>
      )}
    </div>
  );
}
