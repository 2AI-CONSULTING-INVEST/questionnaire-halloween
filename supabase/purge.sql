-- =====================================================================
-- Purge des données expirées (conservation, voir README « Données et conservation »).
-- Idempotent : à exécuter chaque semaine dans Supabase > SQL Editor, ou depuis le backoffice
-- (onglet Journal, bouton « Purger les données expirées », qui applique les mêmes règles par l'API).
-- Mêmes durées que RETENTION_DAYS dans src/lib/db.ts.
-- =====================================================================

-- Réponses : adresse IP, navigateur, attributs d'appareil et tout ce qui est déduit de l'IP (réseau, classe,
-- pays, fuseau, ville, position) effacés après 30 jours (le vote, le jour, le score, l'empreinte et la clé hw HMAC restent : ils servent au classement et à l'anti-fraude).
update responses
   set ip_address = null, user_agent = null, device_info = null,
       ip_net = null, ip_class = null, ip_country = null, ip_timezone = null, ip_city = null, ip_latitude = null, ip_longitude = null
 where created_at < now() - interval '30 days'
   and (ip_address is not null or user_agent is not null or device_info is not null or ip_net is not null or ip_class is not null or ip_country is not null or ip_timezone is not null or ip_city is not null or ip_latitude is not null or ip_longitude is not null);

-- Visites : supprimées après 90 jours.
delete from visits where created_at < now() - interval '90 days';

-- Clics de partage et d'abonnement : supprimés après 90 jours.
delete from clicks where created_at < now() - interval '90 days';

-- Sessions du backoffice (et leurs actions, en cascade) : supprimées après 180 jours.
delete from admin_sessions where created_at < now() - interval '180 days';

-- Échecs de connexion : supprimés après 30 jours.
delete from login_failures where created_at < now() - interval '30 days';

-- Automatisation (si l'extension pg_cron est activée sur le projet Supabase : Database > Extensions) :
-- si une tâche purge-halloween existe déjà, la reprogrammer avec ce bloc (même clause where que l'update ci-dessus).
--   create extension if not exists pg_cron;
--   select cron.schedule('purge-halloween', '0 4 * * 1', $$
--     update responses set ip_address = null, user_agent = null, device_info = null,
--            ip_net = null, ip_class = null, ip_country = null, ip_timezone = null, ip_city = null, ip_latitude = null, ip_longitude = null
--      where created_at < now() - interval '30 days'
--        and (ip_address is not null or user_agent is not null or device_info is not null or ip_net is not null or ip_class is not null
--             or ip_country is not null or ip_timezone is not null or ip_city is not null or ip_latitude is not null or ip_longitude is not null);
--     delete from visits where created_at < now() - interval '90 days';
--     delete from clicks where created_at < now() - interval '90 days';
--     delete from admin_sessions where created_at < now() - interval '180 days';
--     delete from login_failures where created_at < now() - interval '30 days';
--   $$);
