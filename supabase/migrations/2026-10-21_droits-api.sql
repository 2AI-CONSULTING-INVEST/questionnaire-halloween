-- =====================================================================
-- Droits de l'API Supabase (Data API) — à exécuter une fois dans Supabase > SQL Editor.
-- Rend explicites les droits de la clé service_role (seule utilisée, côté serveur) et retire ceux
-- des clés publiques anon / authenticated, inutiles : RLS sans policy les bloquait déjà.
-- Rejouable sans risque.
-- =====================================================================

grant select, insert, update, delete on restaurants, decorations, responses, participants, prizes to service_role;
revoke all on restaurants, decorations, responses, participants, prizes from anon, authenticated;
