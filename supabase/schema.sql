-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- 1. Receipts table
create table if not exists receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  store_name text not null,
  amount numeric(10,2) not null,
  category text not null default 'Other',
  purchased_at timestamptz not null default now(),
  items jsonb default '[]'::jsonb,
  thumbnail_url text,
  -- Transfer-specific fields (bank transfer / wallet like JazzCash, Easypaisa, etc.)
  -- Left null for ordinary purchase receipts.
  receipt_type text not null default 'purchase',
  payment_method text,
  counterparty text,
  reference_no text,
  -- 'expense' (money out) or 'income' (money in) — used to net totals
  -- across the app instead of treating every entry as a spend.
  direction text not null default 'expense',
  created_at timestamptz not null default now()
);

-- Safe to re-run: if you already created this table before transfer support
-- was added, this adds the new columns without touching existing data.
alter table receipts add column if not exists receipt_type text not null default 'purchase';
alter table receipts add column if not exists payment_method text;
alter table receipts add column if not exists direction text not null default 'expense';
alter table receipts add column if not exists counterparty text;
alter table receipts add column if not exists reference_no text;

create index if not exists receipts_user_id_idx on receipts(user_id);
create index if not exists receipts_purchased_at_idx on receipts(purchased_at desc);

-- 2. Enable Row Level Security — this is what stops one user from ever
--    seeing/editing/deleting another user's receipts, enforced at the DB level.
alter table receipts enable row level security;

create policy "Users can view their own receipts"
  on receipts for select
  using (auth.uid() = user_id);

create policy "Users can insert their own receipts"
  on receipts for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own receipts"
  on receipts for update
  using (auth.uid() = user_id);

create policy "Users can delete their own receipts"
  on receipts for delete
  using (auth.uid() = user_id);

-- 3. Storage bucket for receipt images
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
on conflict (id) do nothing;

-- Storage RLS: users can only upload/read/delete inside their own folder
-- (paths are structured as {user_id}/{filename}.jpg)
create policy "Users can upload their own receipt images"
  on storage.objects for insert
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can view their own receipt images"
  on storage.objects for select
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their own receipt images"
  on storage.objects for delete
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );