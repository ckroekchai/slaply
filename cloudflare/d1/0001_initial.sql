pragma foreign_keys = on;

create table if not exists customers (
  id text primary key,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  email text,
  name text,
  business_name text,
  country text default 'TH'
);

create table if not exists scans (
  id text primary key,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  customer_id text references customers(id) on delete set null,
  customer_email text,
  image_url text,
  image_storage_path text,
  product_category text,
  sales_channel text,
  target_customer text,
  price_tier text,
  main_concern text,
  launch_stage text,
  language text not null default 'thai',
  scan_status text not null default 'created',
  payment_status text not null default 'unpaid',
  ai_model text,
  ai_raw_output text,
  ai_validated_output text,
  overall_score integer,
  readiness_level text,
  report_url text,
  error_message text
);

create table if not exists payments (
  id text primary key,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  scan_id text references scans(id) on delete cascade,
  customer_email text,
  provider text,
  provider_payment_id text,
  amount integer,
  currency text not null default 'THB',
  payment_status text not null default 'created',
  paid_at text,
  fee_amount integer,
  refund_status text,
  raw_event text
);

create table if not exists events (
  id text primary key,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  scan_id text references scans(id) on delete cascade,
  customer_email text,
  event_name text not null,
  event_data text
);

create table if not exists scan_costs (
  id text primary key,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  scan_id text references scans(id) on delete cascade,
  model text,
  input_tokens integer,
  output_tokens integer,
  estimated_ai_cost_usd real,
  retry_count integer not null default 0,
  processing_time_ms integer,
  error_reason text
);

create index if not exists scans_customer_email_idx on scans(customer_email);
create index if not exists scans_payment_status_idx on scans(payment_status);
create index if not exists scans_scan_status_idx on scans(scan_status);
create index if not exists events_scan_id_idx on events(scan_id);
create index if not exists payments_scan_id_idx on payments(scan_id);
create index if not exists scan_costs_scan_id_idx on scan_costs(scan_id);
