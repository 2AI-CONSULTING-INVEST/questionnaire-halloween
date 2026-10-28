/**
 * Position approximative déduite de l'adresse IP par Vercel (en-têtes `x-vercel-ip-*`), lue de la
 * même façon pour la connexion au backoffice et pour l'anti-fraude. Aucune demande au navigateur.
 * Précise à la ville, parfois fausse sur les réseaux mobiles. En-têtes absents (développement local)
 * ou invalides : valeurs nulles, aucun effet. Vercel écrase X-Forwarded-For contre l'usurpation ;
 * sa documentation ne dit rien de tel pour ces en-têtes de position (limite écrite dans le README).
 */
export type IpGeo = {
  city: string | null;
  region: string | null;
  country: string | null;
  timezone: string | null;
  latitude: number | null;
  longitude: number | null;
};

export function readGeo(headers: Headers): IpGeo {
  const text = (name: string) => {
    const v = headers.get(name);
    if (!v) return null;
    try {
      return decodeURIComponent(v).slice(0, 120);
    } catch {
      return v.slice(0, 120); // encodage invalide : valeur brute (la connexion et son journal ne doivent pas en dépendre)
    }
  };
  const num = (name: string, max: number) => {
    const raw = headers.get(name);
    const v = Number(raw);
    return raw && Number.isFinite(v) && Math.abs(v) <= max ? v : null;
  };
  const country = text("x-vercel-ip-country");
  const timezone = text("x-vercel-ip-timezone");
  // Bornes alignées sur les colonnes (ip_city varchar(120), ip_timezone varchar(64), ip_country varchar(2)).
  return {
    city: text("x-vercel-ip-city"),
    region: text("x-vercel-ip-country-region"),
    country: country && /^[A-Z]{2}$/.test(country) ? country : null,
    timezone: timezone && timezone.length <= 64 && /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){0,2}$/.test(timezone) ? timezone : null,
    latitude: num("x-vercel-ip-latitude", 90),
    longitude: num("x-vercel-ip-longitude", 180),
  };
}
