create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.users (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  email text not null unique,
  phone text unique,
  avatar text,
  role text not null default 'user' check (role in ('user', 'admin', 'super_admin', 'agent')),
  google_id text,
  token_version integer not null default 0,
  favorites text[] not null default '{}',
  search_history jsonb not null default '[]'::jsonb,
  email_verified boolean not null default false,
  phone_verified boolean not null default false,
  last_login timestamptz,
  password text,
  restricted boolean not null default false,
  verification jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.properties (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  description text not null,
  price numeric not null check (price >= 0),
  location text not null,
  total_package_price numeric check (total_package_price >= 0),
  type text not null check (type in ('1-bedroom', '2-bedroom', '3-bedroom', 'duplex', 'studio', 'mini-flat', 'short-let')),
  listing_type text not null check (listing_type in ('rent', 'short-let')),
  bedrooms integer not null check (bedrooms >= 0),
  bathrooms integer not null check (bathrooms >= 0),
  area numeric not null check (area >= 0),
  amenities text[] not null default '{}',
  images text[] not null default '{}',
  owner_id text not null,
  contact_user_id text,
  created_by text,
  status text not null default 'available' check (status in ('available', 'rented', 'pending')),
  approval_status text not null default 'pending' check (approval_status in ('pending', 'approved', 'rejected')),
  approved_by text,
  approved_at timestamptz,
  approval_note text,
  views integer not null default 0,
  likes integer not null default 0,
  rating numeric not null default 0,
  review_count integer not null default 0,
  -- coordinates jsonb,
  available_from timestamptz,
  minimum_stay integer,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint properties_owner_id_fkey foreign key (owner_id) references public.users(id) on delete restrict,
  constraint properties_contact_user_id_fkey foreign key (contact_user_id) references public.users(id) on delete set null,
  constraint properties_created_by_fkey foreign key (created_by) references public.users(id) on delete set null,
  constraint properties_approved_by_fkey foreign key (approved_by) references public.users(id) on delete set null
);

create table if not exists public.leads (
  id text primary key default gen_random_uuid()::text,
  owner_id text,
  user_id text not null,
  property_id text not null,
  type text not null check (type in ('whatsapp', 'phone', 'message')),
  message text not null default '',
  timestamp timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint leads_owner_id_fkey foreign key (owner_id) references public.users(id) on delete set null,
  constraint leads_user_id_fkey foreign key (user_id) references public.users(id) on delete cascade,
  constraint leads_property_id_fkey foreign key (property_id) references public.properties(id) on delete cascade,
  constraint leads_property_user_unique unique (property_id, user_id)
);

create table if not exists public.notifications (
  id text primary key default gen_random_uuid()::text,
  user_id text not null,
  type text not null check (type in ('referral_earned', 'listing_approved', 'trial_expiring', 'system_update', 'new_message', 'property_match', 'lead_received')),
  title text not null,
  message text not null,
  is_read boolean not null default false,
  link text,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  action_required boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint notifications_user_id_fkey foreign key (user_id) references public.users(id) on delete cascade
);

create table if not exists public.reviews (
  id text primary key default gen_random_uuid()::text,
  property_id text not null,
  user_id text not null,
  rating integer not null check (rating between 1 and 5),
  comment text not null,
  is_verified boolean not null default false,
  response text,
  response_date timestamptz,
  helpful integer not null default 0,
  report_count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint reviews_property_id_fkey foreign key (property_id) references public.properties(id) on delete cascade,
  constraint reviews_user_id_fkey foreign key (user_id) references public.users(id) on delete cascade
);

create index if not exists idx_properties_created_at on public.properties (created_at desc);
create index if not exists idx_properties_status on public.properties (status);
create index if not exists idx_properties_approval_status on public.properties (approval_status);
create index if not exists idx_leads_owner_id on public.leads (owner_id);
create index if not exists idx_notifications_user_id on public.notifications (user_id);
create index if not exists idx_reviews_property_id on public.reviews (property_id);

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
before update on public.users
for each row
execute function public.set_updated_at();

drop trigger if exists properties_set_updated_at on public.properties;
create trigger properties_set_updated_at
before update on public.properties
for each row
execute function public.set_updated_at();

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at
before update on public.leads
for each row
execute function public.set_updated_at();

drop trigger if exists notifications_set_updated_at on public.notifications;
create trigger notifications_set_updated_at
before update on public.notifications
for each row
execute function public.set_updated_at();

drop trigger if exists reviews_set_updated_at on public.reviews;
create trigger reviews_set_updated_at
before update on public.reviews
for each row
execute function public.set_updated_at();
eat 