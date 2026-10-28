-- =====================================================================
-- Clé inter-navigateurs (règle B4 : même ordinateur, autre navigateur, même réseau) : à exécuter une fois
-- dans Supabase > SQL Editor, AVANT de déployer la version qui l'écrit. Additive et rejouable : la
-- migration 2026-10-28_antifraude-votes.sql (déjà exécutée) n'est pas modifiée. HMAC conservé comme
-- hw_key (non purgé). Mêmes instructions à la fin de supabase/schema.sql.
-- =====================================================================

alter table responses add column if not exists xdev_key varchar(64);             -- HMAC de la clé inter-navigateurs
create index if not exists idx_responses_xdev_day on responses(xdev_key, vote_day) where xdev_key is not null;
alter table responses add column if not exists xdev_strict_key varchar(64);      -- HMAC de la clé stricte (polices comprises)
create index if not exists idx_responses_xdev_strict_day on responses(xdev_strict_key, vote_day) where xdev_strict_key is not null;
