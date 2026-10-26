-- =====================================================================
-- REMISE À ZÉRO COMPLÈTE de la base du vote Halloween — IRRÉVERSIBLE.
-- Supprime toutes les tables de l'application et toutes leurs données : votes, participants,
-- lots, restaurants, décorations, journal du backoffice, échecs de connexion, réglages, compteur de visites. Les fichiers déjà envoyés restent dans Supabase Storage
-- (bucket « decorations ») : videz-le à la main si vous voulez repartir de zéro là aussi.
--
-- Ordre : 1) ce fichier, 2) supabase/schema.sql (recrée la structure et les 3 restaurants).
-- À exécuter dans Supabase > SQL Editor, juste avant de déployer la nouvelle version.
-- =====================================================================

-- Garde : refuse de tout supprimer s'il existe des votes validés (vraie opération en cours). Pour
-- forcer, mettez ce bloc en commentaire après avoir exporté les données depuis le backoffice.
do $$
begin
  if to_regclass('public.responses') is not null then
    if exists (select 1 from responses where completed_at is not null) then
      raise exception 'reset.sql : des votes validés existent. Exportez-les, puis commentez la garde en tête du fichier pour forcer.';
    end if;
  end if;
end $$;

begin;

drop table if exists login_failures cascade;
drop table if exists visits cascade;
drop table if exists settings cascade;
drop table if exists admin_actions cascade;
drop table if exists admin_sessions cascade;
drop table if exists prizes cascade;
drop table if exists responses cascade;
drop table if exists participants cascade;
drop table if exists decorations cascade;
drop table if exists restaurants cascade;

drop function if exists set_updated_at() cascade;
drop function if exists pseudo_key(text) cascade;
drop function if exists normalize_fr_phone(text) cascade;

commit;
