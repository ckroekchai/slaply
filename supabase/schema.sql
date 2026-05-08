-- Slaply Phase 1 initial schema
-- Run this in the Supabase SQL editor for the slaply-prod project.

create extension if not exists pgcrypto;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  email text,
  name text,
  business_name text,
  country text default 'TH'
);

create table if not exists public.scans (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  customer_id uuid references public.customers(id),
  customer_email text,
  image_url text not null,
  image_storage_path text,
  product_category text,
  sales_channel text,
  target_customer text,
  price_tier text,
  main_concern text,
  launch_stage text,
  language text default 'thai',
  scan_status text default 'created',
  payment_status text default 'unpaid',
  ai_model text,
  ai_raw_output jsonb,
  ai_validated_output jsonb,
  overall_score int,
  readiness_level text,
  report_url text,
  error_message text
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  scan_id uuid references public.scans(id),
  customer_email text,
  provider text,
  provider_payment_id text,
  amount int,
  currency text default 'THB',
  payment_status text default 'created',
  paid_at timestamp with time zone,
  fee_amount int,
  refund_status text,
  raw_event jsonb
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default now(),
  scan_id uuid references public.scans(id),
  customer_email text,
  event_name text not null,
  event_data jsonb
);

create index if not exists scans_customer_email_idx on public.scans(customer_email);
create index if not exists scans_payment_status_idx on public.scans(payment_status);
create index if not exists scans_scan_status_idx on public.scans(scan_status);
create index if not exists events_scan_id_idx on public.events(scan_id);
create index if not exists payments_scan_id_idx on public.payments(scan_id);

alter table public.customers enable row level security;
alter table public.scans enable row level security;
alter table public.payments enable row level security;
alter table public.events enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'packaging-uploads',
  'packaging-uploads',
  false,
  10485760,
  array['image/jpeg', 'image/png']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
