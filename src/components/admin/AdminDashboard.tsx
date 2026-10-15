"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, LogOut, Moon, RefreshCw, Sun } from "lucide-react";
import { Switch, Tabs } from "radix-ui";
import { useCallback, useEffect, useState } from "react";
import type { Summary } from "@/lib/analytics";
import type { Role } from "@/lib/auth";
import type { Decoration, Participant, Prize, Restaurant, ResponseRow } from "@/lib/schema";
import { Emoji } from "../questionnaire/ui";
import { DecorationsTab } from "./DecorationsTab";
import { OverviewTab, type Filters } from "./OverviewTab";
import { ParticipantsTab } from "./ParticipantsTab";
import { PrizesTab } from "./PrizesTab";
import { RestaurantsTab } from "./RestaurantsTab";
import { ResponsesTab } from "./ResponsesTab";
import { Button } from "./ui";
import { withBase } from "@/lib/base-path";

const REFRESH_MS = 30_000;
const THEME_KEY = "chamas-admin-theme";

function readTheme() {
  try {
    return localStorage.getItem(THEME_KEY) === "dark";
  } catch {
    return false;
  }
}

export function AdminDashboard({ role }: { role: Role }) {
  const router = useRouter();
  const canWrite = role === "admin";
  const [dark, setDark] = useState(false);
  const [filters, setFilters] = useState<Filters>({ from: "", to: "", restaurant: "all" });
  const [summary, setSummary] = useState<Summary | null>(null);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [decorations, setDecorations] = useState<Decoration[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [failed, setFailed] = useState(false);

  // Thème : lu après montage pour éviter un écart d'hydratation.
  useEffect(() => {
    const id = requestAnimationFrame(() => setDark(readTheme()));
    return () => cancelAnimationFrame(id);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
    } catch {
      /* stockage indisponible */
    }
    return () => document.documentElement.classList.remove("dark");
  }, [dark]);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (filters.from) qs.set("from", filters.from);
    if (filters.to) qs.set("to", filters.to);
    if (filters.restaurant !== "all") qs.set("restaurant", filters.restaurant);
    try {
      const [s, r, d, rest, p, pr] = await Promise.all([
        fetch(withBase(`/api/analytics/summary?${qs}`), { cache: "no-store" }),
        fetch(withBase("/api/admin/responses"), { cache: "no-store" }),
        fetch(withBase("/api/decorations"), { cache: "no-store" }),
        fetch(withBase("/api/restaurants"), { cache: "no-store" }),
        fetch(withBase("/api/admin/participants"), { cache: "no-store" }),
        fetch(withBase("/api/prizes"), { cache: "no-store" }),
      ]);
      if (s.status === 401 || r.status === 401) {
        router.replace("/admin/login");
        return;
      }
      if (!s.ok || !r.ok || !d.ok || !rest.ok || !p.ok || !pr.ok) throw new Error("load");
      setSummary(await s.json());
      setResponses(await r.json());
      setDecorations(await d.json());
      setRestaurants(await rest.json());
      setParticipants(await p.json());
      setPrizes(await pr.json());
      setUpdatedAt(new Date());
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [filters, router]);

  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const id = setInterval(() => {
      if (!document.hidden) void load();
    }, REFRESH_MS);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [load]);

  async function logout() {
    await fetch(withBase("/api/admin/logout"), { method: "POST" });
    router.replace("/admin/login");
  }

  const tabClass =
    "whitespace-nowrap border-b-2 border-transparent px-1 pb-3 text-sm font-semibold text-muted transition-colors hover:text-ink data-[state=active]:border-brand data-[state=active]:text-ink dark:text-zinc-400 dark:hover:text-zinc-100 dark:data-[state=active]:text-zinc-100";

  return (
    <div className={`viz-root min-h-dvh bg-canvas text-ink dark:bg-zinc-950 dark:text-zinc-100 ${dark ? "[color-scheme:dark]" : "[color-scheme:light]"}`}>
      <header className="sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <div className="flex items-center gap-3">
            <Emoji name="pumpkin" size={32} />
            <div>
              <h1 className="text-lg font-bold leading-tight">Backoffice Halloween</h1>
              <p className="text-xs text-muted dark:text-zinc-400">
                Chamas Tacos ·{" "}
                <span className={`font-semibold ${canWrite ? "text-success" : "text-amber-600"}`}>
                  {canWrite ? "Lecture / écriture" : "Lecture seule"}
                </span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden text-xs text-muted sm:inline dark:text-zinc-400" aria-live="polite">
              {failed ? "⚠️ Échec de l'actualisation" : updatedAt ? `Actualisé à ${updatedAt.toLocaleTimeString("fr-FR")}` : "Chargement…"}
            </span>
            <Button variant="ghost" onClick={() => void load()} aria-label="Actualiser" disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <label className="flex items-center gap-2 px-2 text-muted dark:text-zinc-400">
              <Sun className="h-4 w-4" aria-hidden />
              <Switch.Root
                checked={dark}
                onCheckedChange={setDark}
                aria-label="Mode sombre"
                className="relative h-6 w-11 rounded-full bg-gray-300 transition-colors data-[state=checked]:bg-brand dark:bg-zinc-700"
              >
                <Switch.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[22px]" />
              </Switch.Root>
              <Moon className="h-4 w-4" aria-hidden />
            </label>
            <Link href="/" target="_blank" className="inline-flex min-h-9 items-center gap-1 rounded-lg px-3 text-sm font-semibold text-muted hover:bg-gray-100 hover:text-ink dark:text-zinc-400 dark:hover:bg-zinc-800">
              Questionnaire <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </Link>
            <Link
              href="/demo"
              target="_blank"
              title="Parcours complet du questionnaire, sans enregistrer de vote ni d'inscription au tirage"
              className="inline-flex min-h-9 items-center gap-1 rounded-lg px-3 text-sm font-semibold text-muted hover:bg-gray-100 hover:text-ink dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Espace démo <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </Link>
            <Button variant="ghost" onClick={logout}>
              <LogOut className="h-4 w-4" aria-hidden /> Déconnexion
            </Button>
          </div>
        </div>
      </header>

      <Tabs.Root defaultValue="overview" className="mx-auto max-w-7xl px-4 py-6 sm:px-8">
        <Tabs.List aria-label="Sections" className="mb-6 flex gap-6 overflow-x-auto border-b border-line dark:border-zinc-800">
          <Tabs.Trigger value="overview" className={tabClass}>Tableau de bord</Tabs.Trigger>
          <Tabs.Trigger value="participants" className={tabClass}>Participants ({participants.length})</Tabs.Trigger>
          <Tabs.Trigger value="prizes" className={tabClass}>Lots ({prizes.length})</Tabs.Trigger>
          <Tabs.Trigger value="responses" className={tabClass}>Réponses</Tabs.Trigger>
          <Tabs.Trigger value="decorations" className={tabClass}>Décorations ({decorations.length})</Tabs.Trigger>
          <Tabs.Trigger value="restaurants" className={tabClass}>Restaurants</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="overview">
          <OverviewTab summary={summary} filters={filters} setFilters={setFilters} restaurants={restaurants.map((r) => r.name)} />
        </Tabs.Content>
        <Tabs.Content value="participants">
          <ParticipantsTab participants={participants} responses={responses} prizes={prizes} canWrite={canWrite} onChanged={load} />
        </Tabs.Content>
        <Tabs.Content value="prizes">
          <PrizesTab prizes={prizes} participants={participants} canWrite={canWrite} onChanged={load} />
        </Tabs.Content>
        <Tabs.Content value="responses">
          <ResponsesTab responses={responses} decorations={decorations} canWrite={canWrite} onChanged={load} />
        </Tabs.Content>
        <Tabs.Content value="decorations">
          <DecorationsTab decorations={decorations} restaurants={restaurants.map((r) => r.name)} canWrite={canWrite} onChanged={load} />
        </Tabs.Content>
        <Tabs.Content value="restaurants">
          <RestaurantsTab restaurants={restaurants} canWrite={canWrite} onChanged={load} />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
