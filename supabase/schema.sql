-- =====================================================================
-- Questionnaire Halloween Chamas Tacos — schéma Supabase (PostgreSQL)
-- À exécuter dans Supabase > SQL Editor.
-- =====================================================================

create extension if not exists pgcrypto;

-- Restaurants (liste de la question 2)
create table if not exists restaurants (
  id uuid primary key default gen_random_uuid(),
  name varchar(150) not null unique,
  city varchar(100),
  created_at timestamptz not null default now()
);

-- Décorations (photos de la question 4)
create table if not exists decorations (
  id uuid primary key default gen_random_uuid(),
  restaurant_name varchar(150) not null,
  image_url text not null,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Réponses (une ligne par session de vote, mise à jour en direct)
create table if not exists responses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid unique not null,

  voter_type varchar(20),                    -- Q1
  selected_restaurant varchar(150),          -- Q2
  visit_period varchar(50),                  -- Q3
  selected_decoration_id uuid references decorations(id) on delete set null, -- Q4
  decoration_impact varchar(50),             -- Q5
  comment text,                              -- Q6
  wants_raffle boolean,                      -- Q7a
  participant_name varchar(100),             -- Q7b
  phone_number varchar(20),                  -- Q7c (format E.164 : +33XXXXXXXXX)
  email varchar(255),                        -- Q7d

  is_winner boolean not null default false,  -- tirage au sort (backoffice)
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

-- updated_at automatique
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists responses_updated_at on responses;
create trigger responses_updated_at before update on responses
  for each row execute function set_updated_at();

-- Sécurité : RLS activé SANS policy => aucune lecture/écriture possible avec la clé anon.
-- Tout passe par les routes API Next.js (clé service_role côté serveur).
alter table restaurants enable row level security;
alter table decorations enable row level security;
alter table responses enable row level security;

-- Bucket public pour les photos de décoration
insert into storage.buckets (id, name, public)
values ('decorations', 'decorations', true)
on conflict (id) do nothing;

-- Restaurants initiaux (complétez la liste depuis le backoffice)
insert into restaurants (name, city) values
  ('CHAMAS TACOS - LILLE FIVES', 'Lille'),
  ('CHAMAS TACOS - LILLE MOULINS', 'Lille'),
  ('CHAMAS TACOS - VILLENEUVE D''ASCQ', 'Villeneuve d''Ascq'),
  ('CHAMAS TACOS - ROUBAIX', 'Roubaix'),
  ('CHAMAS TACOS - DUNKERQUE', 'Dunkerque'),
  ('CHAMAS TACOS - CALAIS', 'Calais')
on conflict (name) do nothing;
