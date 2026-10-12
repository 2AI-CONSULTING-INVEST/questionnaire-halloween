import "server-only";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Decoration, Restaurant, ResponsePatch, ResponseRow } from "./schema";

export type Meta = { ip: string | null; userAgent: string | null };
export type UpdateResult = "ok" | "completed";
export type ListFilter = { completedOnly?: boolean; from?: string; to?: string };

export interface Store {
  readonly kind: "supabase" | "local";
  createResponse(sessionId: string, meta: Meta): Promise<UpdateResult>;
  updateResponse(sessionId: string, patch: ResponsePatch, meta: Meta): Promise<UpdateResult>;
  completeResponse(sessionId: string, data: ResponsePatch, meta: Meta): Promise<UpdateResult>;
  /** Champs du tirage au sort : modifiables même après validation du vote. */
  updateRaffle(sessionId: string, patch: ResponsePatch): Promise<void>;
  getResponse(idOrSessionId: string): Promise<ResponseRow | null>;
  deleteResponse(id: string): Promise<void>;
  listResponses(filter?: ListFilter): Promise<ResponseRow[]>;
  setWinner(id: string, isWinner: boolean): Promise<void>;

  listRestaurants(): Promise<Restaurant[]>;
  addRestaurant(name: string, city: string | null): Promise<Restaurant>;
  deleteRestaurant(id: string): Promise<void>;

  listDecorations(): Promise<Decoration[]>;
  getDecoration(id: string): Promise<Decoration | null>;
  addDecoration(d: Pick<Decoration, "restaurant_name" | "image_url" | "display_order">): Promise<Decoration>;
  updateDecoration(id: string, d: Partial<Pick<Decoration, "restaurant_name" | "display_order">>): Promise<void>;
  deleteDecoration(id: string): Promise<void>;
  uploadImage(file: File): Promise<string>;
}

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------

class SupabaseStore implements Store {
  readonly kind = "supabase" as const;
  constructor(
    private sb: SupabaseClient,
    private bucket: string,
  ) {}

  private check<T>(res: { data: T; error: { message: string } | null }): T {
    if (res.error) throw new Error(res.error.message);
    return res.data;
  }

  async createResponse(sessionId: string, meta: Meta) {
    const res = await this.sb
      .from("responses")
      .upsert(
        { session_id: sessionId, ip_address: meta.ip, user_agent: meta.userAgent },
        { onConflict: "session_id", ignoreDuplicates: true },
      );
    this.check(res);
    return "ok" as const;
  }

  async updateResponse(sessionId: string, patch: ResponsePatch, meta: Meta) {
    const updated = this.check(
      await this.sb
        .from("responses")
        .update(patch)
        .eq("session_id", sessionId)
        .is("completed_at", null)
        .select("id"),
    );
    if (updated && updated.length > 0) return "ok" as const;

    const existing = await this.getResponse(sessionId);
    if (existing?.completed_at) return "completed" as const;
    // La création initiale a échoué (réseau) : on crée la ligne maintenant.
    this.check(
      await this.sb.from("responses").insert({
        session_id: sessionId,
        ip_address: meta.ip,
        user_agent: meta.userAgent,
        ...patch,
      }),
    );
    return "ok" as const;
  }

  async completeResponse(sessionId: string, data: ResponsePatch, meta: Meta) {
    const result = await this.updateResponse(sessionId, data, meta);
    if (result === "completed") return result;
    this.check(
      await this.sb
        .from("responses")
        .update({ completed_at: new Date().toISOString() })
        .eq("session_id", sessionId)
        .is("completed_at", null),
    );
    return "ok" as const;
  }

  async updateRaffle(sessionId: string, patch: ResponsePatch) {
    this.check(await this.sb.from("responses").update(patch).eq("session_id", sessionId));
  }

  async getResponse(idOrSessionId: string) {
    const data = this.check(
      await this.sb
        .from("responses")
        .select("*")
        .or(`id.eq.${idOrSessionId},session_id.eq.${idOrSessionId}`)
        .limit(1),
    );
    return (data?.[0] as ResponseRow | undefined) ?? null;
  }

  async deleteResponse(id: string) {
    this.check(await this.sb.from("responses").delete().eq("id", id));
  }

  async listResponses(filter: ListFilter = {}) {
    const rows: ResponseRow[] = [];
    const page = 1000;
    for (let offset = 0; ; offset += page) {
      let q = this.sb.from("responses").select("*").order("created_at", { ascending: true });
      if (filter.completedOnly) q = q.not("completed_at", "is", null);
      if (filter.from) q = q.gte("created_at", filter.from);
      if (filter.to) q = q.lte("created_at", filter.to);
      const data = this.check(await q.range(offset, offset + page - 1)) as ResponseRow[];
      rows.push(...data);
      if (data.length < page) break;
    }
    return rows;
  }

  async setWinner(id: string, isWinner: boolean) {
    this.check(await this.sb.from("responses").update({ is_winner: isWinner }).eq("id", id));
  }

  async listRestaurants() {
    return this.check(await this.sb.from("restaurants").select("*").order("name")) as Restaurant[];
  }

  async addRestaurant(name: string, city: string | null) {
    return this.check(
      await this.sb.from("restaurants").insert({ name, city }).select("*").single(),
    ) as Restaurant;
  }

  async deleteRestaurant(id: string) {
    this.check(await this.sb.from("restaurants").delete().eq("id", id));
  }

  async listDecorations() {
    return this.check(
      await this.sb
        .from("decorations")
        .select("*")
        .order("display_order")
        .order("created_at"),
    ) as Decoration[];
  }

  async getDecoration(id: string) {
    const data = this.check(await this.sb.from("decorations").select("*").eq("id", id).limit(1));
    return (data?.[0] as Decoration | undefined) ?? null;
  }

  async addDecoration(d: Pick<Decoration, "restaurant_name" | "image_url" | "display_order">) {
    return this.check(await this.sb.from("decorations").insert(d).select("*").single()) as Decoration;
  }

  async updateDecoration(id: string, d: Partial<Pick<Decoration, "restaurant_name" | "display_order">>) {
    this.check(await this.sb.from("decorations").update(d).eq("id", id));
  }

  async deleteDecoration(id: string) {
    this.check(await this.sb.from("decorations").delete().eq("id", id));
  }

  async uploadImage(file: File) {
    const ext = extensionFor(file.type);
    const key = `${randomUUID()}.${ext}`;
    const { error } = await this.sb.storage
      .from(this.bucket)
      .upload(key, await file.arrayBuffer(), { contentType: file.type, cacheControl: "31536000" });
    if (error) throw new Error(error.message);
    return this.sb.storage.from(this.bucket).getPublicUrl(key).data.publicUrl;
  }
}

// ---------------------------------------------------------------------------
// Stockage local JSON — développement uniquement (système de fichiers en
// lecture seule sur Vercel).
// ---------------------------------------------------------------------------

type LocalData = { responses: ResponseRow[]; restaurants: Restaurant[]; decorations: Decoration[] };

const DATA_FILE = path.join(process.cwd(), ".data", "db.json");
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

const SEED_RESTAURANTS = [
  ["CHAMAS TACOS - LILLE FIVES", "Lille"],
  ["CHAMAS TACOS - LILLE MOULINS", "Lille"],
  ["CHAMAS TACOS - VILLENEUVE D'ASCQ", "Villeneuve d'Ascq"],
  ["CHAMAS TACOS - ROUBAIX", "Roubaix"],
  ["CHAMAS TACOS - DUNKERQUE", "Dunkerque"],
  ["CHAMAS TACOS - CALAIS", "Calais"],
] as const;

function seed(): LocalData {
  const now = new Date().toISOString();
  return {
    responses: [],
    restaurants: SEED_RESTAURANTS.map(([name, city]) => ({ id: randomUUID(), name, city, created_at: now })),
    decorations: SEED_RESTAURANTS.map(([name], i) => ({
      id: randomUUID(),
      restaurant_name: name,
      image_url: `/seed/deco-${i + 1}.webp`,
      display_order: i,
      created_at: now,
    })),
  };
}

class LocalStore implements Store {
  readonly kind = "local" as const;
  private queue: Promise<unknown> = Promise.resolve();

  private ready: Promise<void> | null = null;

  /** Crée le fichier de démo une seule fois (évite deux jeux de données concurrents). */
  private ensure() {
    this.ready ??= fs.access(DATA_FILE).catch(() => this.write(seed()));
    return this.ready;
  }

  private async read(): Promise<LocalData> {
    await this.ensure();
    return JSON.parse(await fs.readFile(DATA_FILE, "utf8")) as LocalData;
  }

  private async write(data: LocalData) {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    const tmp = `${DATA_FILE}.${randomUUID()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2));
    await fs.rename(tmp, DATA_FILE);
  }

  /** Sérialise les écritures pour éviter les pertes concurrentes. */
  private mutate<T>(fn: (d: LocalData) => T | Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const data = await this.read();
      const out = await fn(data);
      await this.write(data);
      return out;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  private blank(sessionId: string, meta: Meta): ResponseRow {
    const now = new Date().toISOString();
    return {
      id: randomUUID(),
      session_id: sessionId,
      voter_type: null,
      selected_restaurant: null,
      visit_period: null,
      selected_decoration_id: null,
      decoration_impact: null,
      comment: null,
      wants_raffle: null,
      participant_name: null,
      phone_number: null,
      email: null,
      is_winner: false,
      completed_at: null,
      created_at: now,
      updated_at: now,
      ip_address: meta.ip,
      user_agent: meta.userAgent,
    };
  }

  createResponse(sessionId: string, meta: Meta) {
    return this.mutate((d) => {
      if (!d.responses.some((r) => r.session_id === sessionId)) d.responses.push(this.blank(sessionId, meta));
      return "ok" as const;
    });
  }

  updateResponse(sessionId: string, patch: ResponsePatch, meta: Meta, complete = false) {
    return this.mutate((d) => {
      let row = d.responses.find((r) => r.session_id === sessionId);
      if (row?.completed_at) return "completed" as const;
      if (!row) {
        row = this.blank(sessionId, meta);
        d.responses.push(row);
      }
      Object.assign(row, patch, { updated_at: new Date().toISOString() });
      if (complete) row.completed_at = row.updated_at;
      return "ok" as const;
    });
  }

  completeResponse(sessionId: string, data: ResponsePatch, meta: Meta) {
    return this.updateResponse(sessionId, data, meta, true);
  }

  async updateRaffle(sessionId: string, patch: ResponsePatch) {
    await this.mutate((d) => {
      const row = d.responses.find((r) => r.session_id === sessionId);
      if (row) Object.assign(row, patch, { updated_at: new Date().toISOString() });
    });
  }

  async getResponse(idOrSessionId: string) {
    const d = await this.read();
    return d.responses.find((r) => r.id === idOrSessionId || r.session_id === idOrSessionId) ?? null;
  }

  async deleteResponse(id: string) {
    await this.mutate((d) => {
      d.responses = d.responses.filter((r) => r.id !== id);
    });
  }

  async listResponses(filter: ListFilter = {}) {
    const d = await this.read();
    return d.responses.filter(
      (r) =>
        (!filter.completedOnly || r.completed_at) &&
        (!filter.from || r.created_at >= filter.from) &&
        (!filter.to || r.created_at <= filter.to),
    );
  }

  async setWinner(id: string, isWinner: boolean) {
    await this.mutate((d) => {
      const r = d.responses.find((x) => x.id === id);
      if (r) r.is_winner = isWinner;
    });
  }

  async listRestaurants() {
    const d = await this.read();
    return [...d.restaurants].sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }

  addRestaurant(name: string, city: string | null) {
    return this.mutate((d) => {
      if (d.restaurants.some((r) => r.name === name)) throw new Error("Ce restaurant existe déjà");
      const r: Restaurant = { id: randomUUID(), name, city, created_at: new Date().toISOString() };
      d.restaurants.push(r);
      return r;
    });
  }

  async deleteRestaurant(id: string) {
    await this.mutate((d) => {
      d.restaurants = d.restaurants.filter((r) => r.id !== id);
    });
  }

  async listDecorations() {
    const d = await this.read();
    return [...d.decorations].sort(
      (a, b) => a.display_order - b.display_order || a.created_at.localeCompare(b.created_at),
    );
  }

  async getDecoration(id: string) {
    const d = await this.read();
    return d.decorations.find((x) => x.id === id) ?? null;
  }

  addDecoration(input: Pick<Decoration, "restaurant_name" | "image_url" | "display_order">) {
    return this.mutate((d) => {
      const deco: Decoration = { id: randomUUID(), created_at: new Date().toISOString(), ...input };
      d.decorations.push(deco);
      return deco;
    });
  }

  async updateDecoration(id: string, patch: Partial<Pick<Decoration, "restaurant_name" | "display_order">>) {
    await this.mutate((d) => {
      const deco = d.decorations.find((x) => x.id === id);
      if (deco) Object.assign(deco, patch);
    });
  }

  async deleteDecoration(id: string) {
    await this.mutate((d) => {
      d.decorations = d.decorations.filter((x) => x.id !== id);
      for (const r of d.responses) if (r.selected_decoration_id === id) r.selected_decoration_id = null;
    });
  }

  async uploadImage(file: File) {
    const name = `${randomUUID()}.${extensionFor(file.type)}`;
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.writeFile(path.join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));
    return `/uploads/${name}`;
  }
}

function extensionFor(mime: string) {
  return ({ "image/webp": "webp", "image/png": "png", "image/jpeg": "jpg", "image/avif": "avif" } as Record<string, string>)[mime] ?? "bin";
}

// ---------------------------------------------------------------------------

let store: Store | undefined;

export function getStore(): Store {
  if (store) return store;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    store = new SupabaseStore(
      createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }),
      process.env.SUPABASE_STORAGE_BUCKET || "decorations",
    );
  } else {
    if (process.env.VERCEL) {
      throw new Error("Supabase n'est pas configuré (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).");
    }
    store = new LocalStore();
  }
  return store;
}

export function requestMeta(req: Request, ip: string | null): Meta {
  return { ip, userAgent: req.headers.get("user-agent")?.slice(0, 500) ?? null };
}
