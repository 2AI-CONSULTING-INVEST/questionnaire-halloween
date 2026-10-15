-- =====================================================================
-- Questionnaire Halloween Chamas Tacos — schéma Supabase (PostgreSQL)
-- Installation neuve (ou après supabase/reset.sql) : à exécuter dans Supabase > SQL Editor.
-- Base existante : exécutez plutôt supabase/migrations/*.sql dans l'ordre.
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

-- Décorations (photos / vidéos de la question 3)
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
  email varchar(255) not null,              -- minuscules, sans espaces
  phone_number varchar(20) not null,        -- E.164 : +33XXXXXXXXX
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Noms de contraintes lus par src/lib/db.ts pour traduire l'erreur 23505 en champ en conflit.
  constraint participants_pseudo_key_unique unique (pseudo_key),
  constraint participants_email_unique unique (email),
  constraint participants_phone_unique unique (phone_number),
  constraint participants_phone_format check (phone_number ~ '^\+33[1-9][0-9]{8}$'),
  constraint participants_email_format check (email = lower(btrim(email)) and email like '%@%')
);

-- Réponses (une ligne par session de vote, mise à jour en direct)
create table if not exists responses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid unique not null,

  voter_type varchar(20),                    -- ancienne Q1 (« Qui êtes-vous ? »), plus posée
  selected_restaurant varchar(150),          -- Q1
  visit_period varchar(50),                  -- Q2
  selected_decoration_id uuid references decorations(id) on delete set null, -- Q3
  decoration_impact varchar(50),             -- Q4
  comment text,                              -- Q5
  wants_raffle boolean,                      -- Q6

  -- Anciennes colonnes du tirage (réponses d'avant la table participants) : plus jamais écrites.
  participant_name varchar(100),
  phone_number varchar(20),
  email varchar(255),
  is_winner boolean not null default false,

  participant_id uuid references participants(id) on delete set null, -- inscription au tirage
  voter_id uuid,                             -- appareil (cookie hw_voter)
  vote_day date,                             -- jour du vote à Paris
  completed_at timestamptz,                  -- null = questionnaire non terminé

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ip_address inet,
  user_agent text,

  constraint valid_voter_type check (voter_type in ('client', 'employee')),
  constraint valid_visit_period check (visit_period in ('lundi-jeudi', 'vendredi-samedi', 'dimanche')),
  constraint valid_impact check (decoration_impact in ('beaucoup', 'un_peu', 'pas_du_tout')),
  constraint comment_length check (char_length(comment) <= 300)
);

create index if not exists idx_responses_restaurant on responses(selected_restaurant);
create index if not exists idx_responses_created_at on responses(created_at);
create index if not exists idx_responses_voter_type on responses(voter_type);
create index if not exists idx_responses_decoration on responses(selected_decoration_id);
create index if not exists idx_responses_completed_at on responses(completed_at);
create index if not exists idx_responses_participant on responses(participant_id);
-- Un seul vote validé par appareil et par jour (garanti même en requêtes parallèles).
create unique index if not exists responses_voter_day_unique on responses(voter_id, vote_day) where completed_at is not null;

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

-- Bucket public pour les photos de décoration et les images des lots
insert into storage.buckets (id, name, public)
values ('decorations', 'decorations', true)
on conflict (id) do nothing;

-- Restaurants participants (modifiables depuis le backoffice)
insert into restaurants (name, city) values
  ('CHAMAS TACOS - LILLE FIVES', 'Lille'),
  ('CHAMAS TACOS - LILLE MOULINS', 'Lille'),
  ('CHAMAS TACOS - VILLENEUVE D''ASCQ', 'Villeneuve d''Ascq')
on conflict (name) do nothing;
