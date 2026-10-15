-- =====================================================================
-- REMISE À ZÉRO COMPLÈTE de la base du vote Halloween — IRRÉVERSIBLE.
-- Supprime toutes les tables de l'application et toutes leurs données : votes, participants,
-- lots, restaurants, décorations. Les fichiers déjà envoyés restent dans Supabase Storage
-- (bucket « decorations ») : videz-le à la main si vous voulez repartir de zéro là aussi.
--
-- Ordre : 1) ce fichier, 2) supabase/schema.sql (recrée la structure et les 3 restaurants).
-- À exécuter dans Supabase > SQL Editor, juste avant de déployer la nouvelle version.
-- =====================================================================

begin;

drop table if exists prizes cascade;
drop table if exists responses cascade;
drop table if exists participants cascade;
drop table if exists decorations cascade;
drop table if exists restaurants cascade;

drop function if exists set_updated_at() cascade;
drop function if exists pseudo_key(text) cascade;
drop function if exists normalize_fr_phone(text) cascade;

commit;
