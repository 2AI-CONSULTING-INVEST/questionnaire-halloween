-- =====================================================================
-- Migration : tirage au sort (participants, lots) et vote quotidien.
-- À exécuter dans Supabase > SQL Editor AVANT de déployer le nouveau code.
-- Idempotente : peut être relancée sans effet (if not exists, reprise sans doublon).
-- =====================================================================

begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 0. Fonctions utilitaires (mêmes règles que src/lib/schema.ts)
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

-- ---------------------------------------------------------------------
-- 1. Tables, colonnes, index, triggers
-- ---------------------------------------------------------------------

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

-- Réponses : lien vers le participant, appareil (cookie hw_voter) et jour du vote (Europe/Paris).
alter table responses add column if not exists participant_id uuid references participants(id) on delete set null;
alter table responses add column if not exists voter_id uuid;
alter table responses add column if not exists vote_day date;
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

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists participants_updated_at on participants;
create trigger participants_updated_at before update on participants
  for each row execute function set_updated_at();
drop trigger if exists prizes_updated_at on prizes;
create trigger prizes_updated_at before update on prizes
  for each row execute function set_updated_at();

-- RLS sans policy : tout passe par les routes API (clé service_role).
alter table participants enable row level security;
alter table prizes enable row level security;

-- ---------------------------------------------------------------------
-- 2. Jour du vote des réponses déjà validées (heure de Paris)
-- ---------------------------------------------------------------------

update responses
   set vote_day = (completed_at at time zone 'Europe/Paris')::date
 where completed_at is not null and vote_day is null;

-- ---------------------------------------------------------------------
-- 3. Reprise des inscriptions existantes (wants_raffle + nom + téléphone + email)
--    Même email OU même téléphone = même personne : on garde la plus ancienne.
--    Pseudos rendus uniques (suffixe 2, 3…). Les réponses sont reliées au participant.
-- ---------------------------------------------------------------------

do $$
declare
  r record;
  v_email text;
  v_phone text;
  v_base text;
  v_pseudo text;
  v_key text;
  v_n int;
  v_pid uuid;
begin
  for r in
    select id, participant_name, phone_number, email, completed_at
      from responses
     where completed_at is not null
       and wants_raffle is true
       and participant_id is null
       and participant_name is not null
       and phone_number is not null
       and email is not null
     order by completed_at, created_at
  loop
    v_email := lower(btrim(r.email));
    v_phone := normalize_fr_phone(r.phone_number);
    if v_phone is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      continue; -- coordonnées inexploitables : la réponse reste sans participant (voir rapport)
    end if;

    select id into v_pid from participants
     where email = v_email or phone_number = v_phone
     order by created_at limit 1;

    if v_pid is null then
      -- Pseudo : l'ancien « nom et prénom », espaces fusionnés, 3 à 24 caractères.
      v_base := left(btrim(regexp_replace(r.participant_name, '\s+', ' ', 'g')), 24);
      if length(v_base) < 3 then v_base := left(v_base || ' Participant', 24); end if;
      v_pseudo := v_base;
      v_key := pseudo_key(v_pseudo);
      v_n := 1;
      while exists (select 1 from participants where pseudo_key = v_key) loop
        v_n := v_n + 1;
        v_pseudo := left(v_base, 24 - length(v_n::text)) || v_n::text;
        v_key := pseudo_key(v_pseudo);
      end loop;
      insert into participants (pseudo, pseudo_key, email, phone_number, created_at, updated_at)
      values (v_pseudo, v_key, v_email, v_phone, r.completed_at, r.completed_at)
      returning id into v_pid;
    end if;

    update responses set participant_id = v_pid where id = r.id;
  end loop;
end $$;

commit;

-- ---------------------------------------------------------------------
-- 4. Rapport (à exécuter à part, après la migration) : anciens gagnants « is_winner »,
--    à reporter à la main dans l'onglet « Participants » (aucun lot n'est attribué automatiquement),
--    et inscriptions non reprises (coordonnées invalides).
-- ---------------------------------------------------------------------
-- select r.participant_name, r.email, r.phone_number, r.completed_at, p.pseudo as participant
--   from responses r left join participants p on p.id = r.participant_id
--  where r.is_winner
--  order by r.completed_at;
--
-- select id, participant_name, email, phone_number, completed_at
--   from responses
--  where completed_at is not null and wants_raffle is true and participant_id is null
--    and participant_name is not null and phone_number is not null and email is not null;
