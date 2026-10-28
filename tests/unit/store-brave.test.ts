import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

/**
 * Store JSON de bout en bout (A34) : un Brave sur ordinateur, clés brouillées, est relié par son réseau à la
 * tentative Chrome du jour, et sa validation passe en attente (H10). Le store local écrit dans
 * <dossier courant>/.data/db.json : le test se place dans un dossier temporaire (jamais le fichier du
 * dépôt) et retire les variables Supabase (jamais la base de production).
 */
const DAY = "2026-10-28";
const dir = mkdtempSync(path.join(tmpdir(), "store-brave-"));
const cwd = process.cwd();
let db: typeof import("../../src/lib/db");
let server: typeof import("../../src/lib/fraud-server");
let risk: typeof import("../../src/lib/risk");

before(async () => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.VERCEL;
  process.env.ADMIN_SESSION_SECRET ??= "test-secret-de-session-assez-long-0123456789";
  mkdirSync(path.join(dir, ".data"));
  const at = `${DAY}T10:00:00.000Z`;
  const chrome = {
    id: "00000000-0000-4000-8000-000000000001", session_id: "10000000-0000-4000-8000-000000000001",
    selected_restaurant: "R", selected_decoration_id: "d1", comment: null, wants_raffle: null, participant_id: null,
    voter_id: "20000000-0000-4000-8000-000000000001", vote_day: DAY, completed_at: at, created_at: at, updated_at: at,
    ip_address: "203.0.113.50", user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/156.0", device_hash: null, device_info: null,
    risk_score: 0, risk_flags: null, blocked_at: null, excluded_at: null, ip_net: "203.0.113.50", hw_key: "a".repeat(64), hw_entropy: "strong",
    xdev_key: "b".repeat(64), xdev_strict_key: "c".repeat(64),
  };
  writeFileSync(path.join(dir, ".data", "db.json"), JSON.stringify({ responses: [chrome], restaurants: [], decorations: [], participants: [], prizes: [], admin_sessions: [], admin_actions: [], settings: {}, visits: [], clicks: [], login_failures: [] }));
  process.chdir(dir); // DATA_FILE est calculé au chargement du module
  db = await import("../../src/lib/db");
  server = await import("../../src/lib/fraud-server");
  risk = await import("../../src/lib/risk");
});
after(() => {
  process.chdir(cwd);
  rmSync(dir, { recursive: true, force: true });
});

describe("store JSON : Brave relié par le réseau (A34)", () => {
  it("relatedAttempts avec le réseau du Brave renvoie la tentative Chrome du même réseau ; sans réseau, rien", async () => {
    const store = db.getStore();
    assert.equal(store.kind, "local");
    const keys = { voterId: null, hwKey: "d".repeat(64), storageKeys: [], xdevKey: "e".repeat(64), xdevStrictKey: "f".repeat(64) };
    assert.equal((await store.relatedAttempts(DAY, { ...keys, ipNet: "203.0.113.50" })).length, 1);
    assert.equal((await store.relatedAttempts(DAY, keys)).length, 0);
  });
  it("validation du Brave sur le même réseau : en attente (H10), jamais refusé", async () => {
    const store = db.getStore();
    const sig = {
      stamp: { hw_key: "d".repeat(64), hw_entropy: "noisy" as const, xdev_key: "e".repeat(64), xdev_strict_key: "f".repeat(64), ip_net: "203.0.113.50", ip_city: null, private_mode: null },
      storageKeys: [],
      ip: "203.0.113.50",
      ipClass: "normal" as const,
      country: null,
      tzMismatch: false,
      langMismatch: false,
      computer: true,
      brave: true,
    };
    const d = await server.decideVote(store, risk.DEFAULT_RISK_SETTINGS, { day: DAY, nowMs: Date.parse(`${DAY}T11:00:00.000Z`), voterId: "20000000-0000-4000-8000-000000000002", decorationId: "d1", score: 0, ipCapped: false, sig });
    assert.deepEqual([d.outcome, d.reasons.includes("H10")], ["held", true]);
  });
});
