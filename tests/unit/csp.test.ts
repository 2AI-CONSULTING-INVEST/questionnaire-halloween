import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCsp, securityHeaders } from "../../src/lib/csp";

describe("buildCsp (F-07)", () => {
  it("sans hôte Supabase : politique de base, aucun hôte externe", () => {
    const csp = buildCsp();
    assert.ok(csp.startsWith("default-src 'self'; "));
    assert.ok(csp.includes("script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'"));
    assert.ok(csp.includes("img-src 'self' data: blob:;"));
    assert.ok(csp.includes("media-src 'self' blob:;"));
    assert.ok(csp.includes("connect-src 'self';"));
    assert.ok(csp.includes("frame-ancestors 'none'") && csp.includes("object-src 'none'") && csp.endsWith("upgrade-insecure-requests"));
    assert.ok(!csp.includes("https://"));
  });
  it("avec hôte Supabase : images, médias et connexions vers cet hôte seulement", () => {
    const csp = buildCsp("abc.supabase.co");
    assert.ok(csp.includes("img-src 'self' data: blob: https://abc.supabase.co;"));
    assert.ok(csp.includes("media-src 'self' blob: https://abc.supabase.co;"));
    assert.ok(csp.includes("connect-src 'self' https://abc.supabase.co;"));
    assert.ok(csp.includes("script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval';"), "aucun script externe");
  });
  it("URL vidéo externe : hôte ajouté à media-src seulement ; URL invalide ignorée", () => {
    const csp = buildCsp("abc.supabase.co", "https://cdn.example.com/video.mp4?x=1");
    assert.ok(csp.includes("media-src 'self' blob: https://abc.supabase.co https://cdn.example.com;"));
    assert.ok(!csp.includes("img-src 'self' data: blob: https://abc.supabase.co https://cdn"));
    assert.equal(buildCsp("abc.supabase.co", "pas une url"), buildCsp("abc.supabase.co"));
  });
  it("securityHeaders : HSTS 2 ans, COOP same-origin, pas de COEP, CSP en Report-Only", () => {
    const h = Object.fromEntries(securityHeaders("abc.supabase.co").map((x) => [x.key, x.value]));
    assert.equal(h["Strict-Transport-Security"], "max-age=63072000; includeSubDomains");
    assert.equal(h["Cross-Origin-Opener-Policy"], "same-origin");
    assert.ok(!("Cross-Origin-Embedder-Policy" in h));
    assert.ok(h["Content-Security-Policy-Report-Only"] && !("Content-Security-Policy" in h));
    assert.equal(h["X-Frame-Options"], "DENY");
  });
});
