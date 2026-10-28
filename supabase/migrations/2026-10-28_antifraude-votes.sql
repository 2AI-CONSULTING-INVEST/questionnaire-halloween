-- =====================================================================
-- Anti-fraude des votes (clé matérielle, jeton de stockage, classe et position de l'IP, votes en
-- attente, exclusion automatique par groupes) : à exécuter une fois dans Supabase > SQL Editor,
-- AVANT de déployer la version qui les lit. Additive (aucune colonne supprimée ni renommée) et
-- rejouable sans risque : le concours est en cours, les lignes existantes restent valides.
-- Mêmes instructions que dans supabase/schema.sql (qui reste la référence d'une base neuve).
-- =====================================================================

alter table responses add column if not exists hw_key varchar(64);              -- HMAC de la clé matérielle stable
alter table responses add column if not exists hw_entropy varchar(8);           -- strong, weak, noisy
alter table responses add column if not exists private_mode boolean;            -- navigation privée (null : incertain)
alter table responses add column if not exists storage_key varchar(64);         -- HMAC du jeton remis à l'appareil
alter table responses add column if not exists seen_storage jsonb;              -- HMAC des jetons retrouvés dans son stockage
alter table responses add column if not exists ip_net varchar(45);              -- IPv4 exacte ou préfixe /64 IPv6
alter table responses add column if not exists ip_class varchar(10);            -- normal, tor, hosting, relay, unknown
alter table responses add column if not exists ip_country varchar(2);
alter table responses add column if not exists ip_timezone varchar(64);
alter table responses add column if not exists ip_city varchar(120);
alter table responses add column if not exists ip_latitude double precision;
alter table responses add column if not exists ip_longitude double precision;
alter table responses add column if not exists block_stage varchar(10);         -- create ou complete
alter table responses add column if not exists held_at timestamptz;             -- vote en attente : jamais compté
alter table responses add column if not exists held_priority boolean not null default false;
alter table responses add column if not exists exclusion_source varchar(5);     -- admin ou auto
alter table responses add column if not exists group_id varchar(40);            -- groupe confirmé du moteur
alter table responses add column if not exists human_decision varchar(10);      -- validated ou excluded : le moteur n'y touche plus
alter table responses add column if not exists fraud_reasons jsonb;             -- règles appliquées (B1 à B3, H1 à H9)
alter table responses add column if not exists observed_outcome varchar(10);    -- issue évitée en mode observation

-- Les exclusions antérieures ont toutes été faites à la main.
update responses set exclusion_source = 'admin', human_decision = 'excluded'
 where excluded_at is not null and exclusion_source is null;

create index if not exists idx_responses_hw_day on responses(hw_key, vote_day) where hw_key is not null;
create index if not exists idx_responses_participant_day on responses(participant_id, vote_day) where participant_id is not null;
create index if not exists idx_responses_storage_day on responses(storage_key, vote_day) where storage_key is not null;
create index if not exists idx_responses_vote_day on responses(vote_day);
create index if not exists idx_responses_held on responses(held_at) where held_at is not null and excluded_at is null;

-- Deux validations parallèles ne produisent jamais deux votes comptés pour la même clé forte le même
-- jour (garantie en base). Un vote validé à la main par un admin n'y est pas soumis, ni un vote du
-- mode observation qui a noté une issue évitée (observed_outcome) : ce mode ne change rien de visible.
-- Recréé à chaque passage : une version antérieure de l'index (sans la condition observed_outcome) est remplacée.
drop index if exists responses_hw_counted_unique;
create unique index responses_hw_counted_unique on responses(hw_key, vote_day)
  where hw_entropy = 'strong' and completed_at is not null and held_at is null and excluded_at is null and human_decision is null
    and observed_outcome is null;
