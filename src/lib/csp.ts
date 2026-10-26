/**
 * En-têtes de sécurité (next.config.ts). Fonction pure : testée sans serveur.
 * CSP en mode « Report-Only » d'abord : les violations s'affichent dans la console du navigateur
 * sans rien bloquer ; une fois propre, renommer l'en-tête en `Content-Security-Policy` (README).
 */
export function buildCsp(supabaseHost?: string | null, videoUrl?: string | null): string {
  const supabase = supabaseHost ? ` https://${supabaseHost}` : "";
  let video = "";
  try {
    const host = videoUrl ? new URL(videoUrl).host : "";
    if (host) video = ` https://${host}`;
  } catch {
    /* URL vidéo invalide : ignorée */
  }
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'", // scripts inline de Next, décodeur 3D (Meshopt, WebAssembly)
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${supabase}`,
    `media-src 'self' blob:${supabase}${video}`,
    `connect-src 'self'${supabase}`,
    "font-src 'self'",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export function securityHeaders(supabaseHost?: string | null, videoUrl?: string | null) {
  return [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    { key: "Content-Security-Policy-Report-Only", value: buildCsp(supabaseHost, videoUrl) },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" }, // pas de COEP : casserait les images Supabase
  ];
}
