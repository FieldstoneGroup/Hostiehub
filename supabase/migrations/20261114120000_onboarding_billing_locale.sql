-- Additive columns for guided onboarding, monthly billing and locale.
-- Does not alter, rename, or drop existing columns.
-- Does not create, drop, or weaken RLS policies.
-- New columns are covered by the existing row policies on hosts and properties
-- (hosts: own profile; properties: host manages own rows).

alter table public.hosts
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status text,
  add column if not exists listing_platform text,
  add column if not exists listing_url text,
  add column if not exists property_type text,
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists preferred_locale text;

alter table public.properties
  add column if not exists listing_url text,
  add column if not exists property_type text,
  add column if not exists source_platform text,
  add column if not exists photo_urls jsonb not null default '[]'::jsonb,
  add column if not exists location_label text;

comment on column public.hosts.stripe_subscription_id is
  'Stripe Billing subscription for the monthly host plan. Null until a price id is configured and the host subscribes. Guest sales stay on Stripe Connect with a zero application fee.';
comment on column public.hosts.subscription_status is
  'Stripe subscription status: trialing, active, past_due, canceled, unpaid. Null when the host has not subscribed.';
comment on column public.hosts.trial_ends_at is
  'Existing column. End of the first free month. Reused by monthly billing. No charge is created while HOSTIE_STRIPE_PRICE_ID is empty.';
comment on column public.hosts.plan is
  'Existing column. Monthly billing keeps the value host. Yearly pro/host amounts are no longer offered in the UI.';
comment on column public.properties.photo_urls is
  'Public image URLs read from a listing page during onboarding. Empty array when the page could not be read.';
