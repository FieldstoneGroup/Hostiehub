-- Refunds issued from the host dashboard (worker X-Service: process-refund).
-- Additive only. Does not alter, rename, or drop existing columns.
-- Does not create, drop, or weaken RLS policies.
-- The worker writes these columns with the service role. The browser does not.
--
-- status stays unconstrained text. Existing values (pending, paid, fulfilled)
-- are unchanged. The worker also writes:
--   refunded
--   partially_refunded

alter table public.orders
  add column if not exists stripe_payment_intent_id text,
  add column if not exists stripe_refund_id text,
  add column if not exists refunded_cents integer default 0,
  add column if not exists refunded_amount numeric default 0,
  add column if not exists refunded_at timestamptz;

comment on column public.orders.stripe_payment_intent_id is
  'PaymentIntent on the host Stripe Connect account (direct charge). Null until a refund is created.';
comment on column public.orders.stripe_refund_id is
  'Latest Stripe refund id (re_...) on the connected account. Null if this order has never been refunded.';
comment on column public.orders.refunded_cents is
  'Cumulative amount refunded, in cents. Defaults to 0 so existing orders stay fully refundable.';
comment on column public.orders.refunded_amount is
  'Cumulative amount refunded, in AUD. Matches refunded_cents. Defaults to 0.';
comment on column public.orders.refunded_at is
  'When the latest refund was recorded. Null if this order has never been refunded.';
comment on column public.orders.status is
  'Order status. Existing values: pending, paid, fulfilled. Refunds also use refunded and partially_refunded.';
