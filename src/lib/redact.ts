import { formatFrPhone, type Participant, type ResponseRow, type Visit } from "./schema";

/** Champs anti-fraude masqués pour le rôle « lecture seule » : clé matérielle, stockage, réseau et tout ce qui est déduit de l'IP. */
const VIEWER_HIDDEN = [
  "hw_key",
  "hw_entropy",
  "private_mode",
  "storage_key",
  "seen_storage",
  "ip_net",
  "ip_class",
  "ip_country",
  "ip_timezone",
  "ip_city",
  "ip_latitude",
  "ip_longitude",
] as const satisfies readonly (keyof ResponseRow)[];

/**
 * Ce que le rôle « lecture seule » ne voit pas : adresse IP, navigateur, empreinte, attributs d'appareil
 * et signaux anti-fraude des réponses ; email et téléphone des participants masqués dans les listes.
 */
export function redactForViewer<T extends Pick<ResponseRow, "ip_address" | "user_agent" | "device_hash" | "device_info">>(row: T): T {
  const out: Record<string, unknown> = { ...row, ip_address: null, user_agent: null, device_hash: null, device_info: null };
  for (const k of VIEWER_HIDDEN) if (k in out) out[k] = null;
  return out as T;
}

/** `jeanne@example.com` → `j***@example.com`. */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  return at > 0 ? `${email[0]}***${email.slice(at)}` : "***";
}

/** `+33713554467` → `07 ** ** ** 67`. */
export function maskPhone(e164: string): string {
  const parts = formatFrPhone(e164).split(" ");
  return parts.length === 5 ? `${parts[0]} ** ** ** ${parts[4]}` : "** ** ** ** **";
}

/** `Jeanne` → `J***` ; vide ou absent inchangé. */
export const maskName = (name: string | null | undefined) => (name ? `${name[0]}***` : name);

export function maskParticipant<T extends Pick<Participant, "email" | "phone_number" | "first_name" | "last_name">>(p: T): T {
  return { ...p, email: maskEmail(p.email), phone_number: maskPhone(p.phone_number), first_name: maskName(p.first_name), last_name: maskName(p.last_name) };
}

/** `1.2.3.4` → `1.2.3.*` ; IPv6 (ou autre) → `***`. */
export const maskIp = (ip: string) => (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip) ? ip.replace(/\.\d{1,3}$/, ".*") : "***");

/** Visite vue par le rôle « lecture seule » : sans IP, navigateur, empreinte ni attributs d'appareil. */
export function redactVisitForViewer<T extends Pick<Visit, "ip" | "user_agent" | "device_hash" | "device_info">>(v: T): T {
  return { ...v, ip: null, user_agent: null, device_hash: null, device_info: null };
}

const SENSITIVE_KEYS = new Set(["email", "phone_number", "first_name", "last_name", "password"]);

/** Corps d'une requête admin avant le journal : coordonnées et mots de passe remplacés par « *** » (premier niveau). */
export function maskDetails(details: unknown): unknown {
  if (!details || typeof details !== "object" || Array.isArray(details)) return details;
  return Object.fromEntries(Object.entries(details).map(([k, v]) => [k, SENSITIVE_KEYS.has(k) && v != null ? "***" : v]));
}
