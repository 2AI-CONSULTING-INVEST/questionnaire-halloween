-- =====================================================================
-- Questionnaire Halloween Chamas Tacos : schéma Supabase (PostgreSQL)
-- Installation neuve (ou après supabase/reset.sql) : à exécuter dans Supabase > SQL Editor.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Fonctions utilitaires (mêmes règles que src/lib/schema.ts)
-- ---------------------------------------------------------------------

-- Clé d'unicité d'un pseudonyme : espaces fusionnés, minuscules, sans accents (lettres latines).
create or replace function pseudo_key(p text) returns text
language sql immutable strict as $$
  select lower(translate(
    btrim(regexp_replace(p, '\s+', ' ', 'g')),
    'ÀÁÂÃÄÅàáâãäåÇçÈÉÊËèéêëÌÍÎÏìíîïÑñÒÓÔÕÖØòóôõöøÙÚÛÜùúûüÝŸýÿ',
    'AAAAAAaaaaaaCcEEEEeeeeIIIIiiiiNnOOOOOOooooooUUUUuuuuYYyy'
  ));
$$;

-- Numéro français → E.164 (+33XXXXXXXXX), null si invalide.
create or replace function normalize_fr_phone(p text) returns text
language sql immutable strict as $$
  select case
    when d ~ '^0[1-9][0-9]{8}$'     then '+33' || substr(d, 2)
    when d ~ '^\+33[1-9][0-9]{8}$'  then d
    when d ~ '^0033[1-9][0-9]{8}$'  then '+33' || substr(d, 5)
    else null
  end
  from (select regexp_replace(p, '[\s.()-]', '', 'g') as d) t;
$$;

-- updated_at automatique
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

-- Restaurants (liste de la question 1)
create table if not exists restaurants (
  id uuid primary key default gen_random_uuid(),
  name varchar(150) not null unique,
  city varchar(100),
  created_at timestamptz not null default now()
);

-- Décorations (photos / vidéos de la question 2)
create table if not exists decorations (
  id uuid primary key default gen_random_uuid(),
  restaurant_name varchar(150) not null,
  image_url text not null,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Participants au tirage : une personne = un email, un téléphone, un pseudonyme (uniques).
create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  pseudo varchar(24) not null,
  pseudo_key varchar(24) not null,          -- minuscules, sans accents, espaces fusionnés
  first_name varchar(50),                   -- facultatif
  last_name varchar(50),                    -- facultatif
  email varchar(255) not null,              -- minuscules, sans espaces
  phone_number varchar(20) not null,        -- E.164 : +33XXXXXXXXX
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,                   -- suppression douce (backoffice), restaurable
  constraint participants_phone_format check (phone_number ~ '^\+33[1-9][0-9]{8}$'),
  constraint participants_email_format check (email = lower(btrim(email)) and email like '%@%')
);

-- Base existante : prénom / nom (facultatifs) et suppression douce des participants.
alter table participants add column if not exists first_name varchar(50);
alter table participants add column if not exists last_name varchar(50);
alter table participants add column if not exists deleted_at timestamptz;
-- Unicité des participants ACTIFS seulement (une personne supprimée peut se réinscrire) : index uniques
-- partiels. Leurs noms sont lus par src/lib/db.ts pour traduire l'erreur 23505 en champ en conflit
-- (Postgres signale un index unique avec le même message « violates unique constraint "…" »).
alter table participants drop constraint if exists participants_pseudo_key_unique;
alter table participants drop constraint if exists participants_email_unique;
alter table participants drop constraint if exists participants_phone_unique;
create unique index if not exists participants_pseudo_key_unique on participants(pseudo_key) where deleted_at is null;
create unique index if not exists participants_email_unique on participants(email) where deleted_at is null;
create unique index if not exists participants_phone_unique on participants(phone_number) where deleted_at is null;

-- Réponses (une ligne par session de vote, mise à jour en direct)
create table if not exists responses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid unique not null,

  selected_restaurant varchar(150),          -- Q1
  selected_decoration_id uuid references decorations(id) on delete set null, -- Q2
  comment text,                              -- Q3
  wants_raffle boolean,                      -- Q4

  participant_id uuid references participants(id) on delete set null, -- inscription au tirage
  voter_id uuid,                             -- appareil (cookie hw_voter)
  vote_day date,                             -- jour du vote à Paris
  completed_at timestamptz,                  -- null = questionnaire non terminé

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ip_address inet,
  user_agent text,

  -- Anti-fraude (src/lib/risk.ts) : empreinte HMAC de l'appareil, attributs grossiers, score et
  -- signaux calculés à la validation ; refus par score (blocked_at, completed_at reste null) ;
  -- exclusion manuelle du classement (excluded_at).
  device_hash varchar(64),
  device_info jsonb,
  risk_score int not null default 0,
  risk_flags jsonb,
  blocked_at timestamptz,
  excluded_at timestamptz,

  constraint comment_length check (char_length(comment) <= 300)
);

-- Base existante (avant l'anti-fraude) : mêmes colonnes, ajoutées sans toucher aux données.
alter table responses add column if not exists device_hash varchar(64);
alter table responses add column if not exists device_info jsonb;
alter table responses add column if not exists risk_score int not null default 0;
alter table responses add column if not exists risk_flags jsonb;
alter table responses add column if not exists blocked_at timestamptz;
alter table responses add column if not exists excluded_at timestamptz;

create index if not exists idx_responses_restaurant on responses(selected_restaurant);
create index if not exists idx_responses_created_at on responses(created_at);
create index if not exists idx_responses_decoration on responses(selected_decoration_id);
create index if not exists idx_responses_completed_at on responses(completed_at);
create index if not exists idx_responses_participant on responses(participant_id);
-- Un seul vote validé par appareil et par jour (garanti même en requêtes parallèles).
create unique index if not exists responses_voter_day_unique on responses(voter_id, vote_day) where completed_at is not null;
-- Score de risque : votes validés du jour par empreinte et par IP.
create index if not exists idx_responses_device_day on responses(device_hash, vote_day) where completed_at is not null;
create index if not exists idx_responses_ip_day on responses(ip_address, vote_day) where completed_at is not null;
-- Pagination par curseur du backoffice (created_at desc, id desc).
create index if not exists idx_responses_keyset on responses(created_at desc, id desc);
create index if not exists idx_participants_keyset on participants(created_at desc, id desc);

-- Anti-fraude des votes (2026-10-28, voir supabase/migrations/2026-10-28_antifraude-votes.sql) :
-- clé matérielle, jeton de stockage, classe et position de l'IP, votes en attente, groupes.
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

-- Réglages du backoffice (clé « risk » : mode et seuils du score de risque).
create table if not exists settings (
  key varchar(64) primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Lots à gagner : un lot a au plus un gagnant, un participant gagne au plus un lot.
create table if not exists prizes (
  id uuid primary key default gen_random_uuid(),
  name varchar(120) not null,
  description text,
  image_url text,
  display_order int not null default 0,
  winner_participant_id uuid references participants(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prizes_winner_unique unique (winner_participant_id),
  constraint prizes_description_length check (char_length(description) <= 500)
);

-- Journal du backoffice : une ligne par connexion (IP et position approximative déduite de l'IP,
-- fournie par Vercel : ville, région, pays, latitude / longitude), et chaque action de la session.
create table if not exists admin_sessions (
  id uuid primary key default gen_random_uuid(),
  role varchar(10) not null,                -- admin | viewer
  ip varchar(45),
  user_agent text,
  city varchar(120),
  region varchar(120),
  country varchar(8),
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz                    -- déconnexion ou révocation depuis le Journal : jeton refusé
);
-- Base existante : révocation des sessions du backoffice.
alter table admin_sessions add column if not exists revoked_at timestamptz;
create table if not exists admin_actions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references admin_sessions(id) on delete cascade,
  method varchar(8) not null,
  path text not null,
  action text not null,                     -- libellé lisible (« Suppression : participant »)
  details jsonb,                            -- corps JSON de la requête (tronqué), le cas échéant
  created_at timestamptz not null default now()
);
create index if not exists idx_admin_actions_session on admin_actions(session_id, created_at);

-- Échecs de connexion au backoffice (src/app/api/admin/login/route.ts) : verrouillage persistant,
-- 10 échecs par IP ou 30 toutes IP en 15 minutes → 429 pendant 15 minutes. Purgés après 30 jours.
create table if not exists login_failures (
  id uuid primary key default gen_random_uuid(),
  ip varchar(45),
  created_at timestamptz not null default now()
);
create index if not exists idx_login_failures_ip_created on login_failures(ip, created_at);
create index if not exists idx_login_failures_created on login_failures(created_at);

-- Compteur de visites (src/lib/visits.ts) : une ligne par beacon accepté ou rejeté (`rejected` = raison :
-- ua_bot, webdriver, no_js_signals, ua_mismatch, rate ; null = visite comptée). Une ligne rejetée ne garde
-- que ip, user_agent, rejected, day.
create table if not exists visits (
  id uuid primary key default gen_random_uuid(),
  day date not null,                        -- jour à Paris
  created_at timestamptz not null default now(),
  ip varchar(45),
  user_agent text,
  path varchar(200),
  referrer varchar(120),                    -- hôte seulement
  device_hash varchar(64),                  -- HMAC, comme responses.device_hash
  device_info jsonb,
  visitor_id uuid,                          -- cookie hw_voter s'il existe
  rejected varchar(20)
);
create index if not exists idx_visits_day on visits(day);
create index if not exists idx_visits_device_day on visits(device_hash, day);
create index if not exists idx_visits_keyset on visits(created_at desc, id desc);

-- Clics de partage et d'abonnement (src/lib/clicks.ts) : share (bouton de partage, `ref` = code mis
-- dans le lien partagé), arrival (arrivée par un lien partagé, `ref` = code reçu), follow (carte
-- « S'abonner »). `voter_id` = cookie hw_voter de l'auteur du clic : il relie un partage, puis les
-- personnes qu'il a ramenées, à leurs votes et à leur pseudo du tirage. Supprimés après 90 jours.
create table if not exists clicks (
  id uuid primary key default gen_random_uuid(),
  day date not null,                        -- jour à Paris
  created_at timestamptz not null default now(),
  kind varchar(10) not null check (kind in ('share', 'arrival', 'follow')),
  target varchar(20) not null,              -- whatsapp, snapchat, instagram, tiktok, copy
  ref varchar(10),
  voter_id uuid
);
create index if not exists idx_clicks_created on clicks(created_at);
create index if not exists idx_clicks_ref on clicks(ref);

drop trigger if exists responses_updated_at on responses;
create trigger responses_updated_at before update on responses
  for each row execute function set_updated_at();
drop trigger if exists participants_updated_at on participants;
create trigger participants_updated_at before update on participants
  for each row execute function set_updated_at();
drop trigger if exists prizes_updated_at on prizes;
create trigger prizes_updated_at before update on prizes
  for each row execute function set_updated_at();

-- Sécurité : RLS activé SANS policy => aucune lecture/écriture possible avec la clé anon.
-- Tout passe par les routes API Next.js (clé service_role côté serveur).
alter table restaurants enable row level security;
alter table decorations enable row level security;
alter table responses enable row level security;
alter table participants enable row level security;
alter table prizes enable row level security;
alter table admin_sessions enable row level security;
alter table admin_actions enable row level security;
alter table settings enable row level security;
alter table visits enable row level security;
alter table clicks enable row level security;
alter table login_failures enable row level security;

-- Droits de l'API Supabase (Data API) : depuis le 30/10/2026, une table neuve de « public » n'en a
-- plus aucun par défaut. Seule la clé service_role (serveur) en a besoin ; anon et authenticated
-- n'ont rien (les clés publiques ne peuvent même pas tenter une lecture).
grant select, insert, update, delete on restaurants, decorations, responses, participants, prizes, admin_sessions, admin_actions, settings, visits, clicks, login_failures to service_role;
revoke all on restaurants, decorations, responses, participants, prizes, admin_sessions, admin_actions, settings, visits, clicks, login_failures from anon, authenticated;

-- Bucket public pour les photos de décoration et les images des lots
insert into storage.buckets (id, name, public)
values ('decorations', 'decorations', true)
on conflict (id) do nothing;
-- Limites du bucket (50 Mo, images et vidéos seulement), appliquées aussi à l'envoi direct par URL signée.
update storage.buckets
   set file_size_limit = 52428800,
       allowed_mime_types = array['image/jpeg','image/png','image/webp','image/avif','video/mp4','video/webm']
 where id = 'decorations';

-- Restaurants participants (modifiables depuis le backoffice)
insert into restaurants (name, city) values
  ('CHAMAS TACOS - LILLE FIVES', 'Lille'),
  ('CHAMAS TACOS - LILLE MOULINS', 'Lille'),
  ('CHAMAS TACOS - VILLENEUVE D''ASCQ', 'Villeneuve d''Ascq')
on conflict (name) do nothing;

-- =====================================================================
-- Clé inter-navigateurs (règle B4 : même ordinateur, autre navigateur, même réseau). Même contenu que
-- supabase/migrations/2026-10-28b_cle-inter-navigateurs.sql. HMAC conservé comme hw_key (non purgé).
-- =====================================================================
alter table responses add column if not exists xdev_key varchar(64);             -- HMAC de la clé inter-navigateurs
create index if not exists idx_responses_xdev_day on responses(xdev_key, vote_day) where xdev_key is not null;
alter table responses add column if not exists xdev_strict_key varchar(64);      -- HMAC de la clé stricte (polices comprises)
create index if not exists idx_responses_xdev_strict_day on responses(xdev_strict_key, vote_day) where xdev_strict_key is not null;
