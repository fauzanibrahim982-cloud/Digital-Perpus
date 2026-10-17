-- DIGITAL PERPUS UPGRADE V2 (ADDITIVE MIGRATION)
-- Run this in Supabase SQL Editor AFTER backing up the project.
-- This script adds columns/tables/buckets and replaces the broad PDF read policy
-- so paid PDFs require seller approval. It does NOT drop existing user/book data.

alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists banner_url text;
alter table public.profiles add column if not exists qris_image_url text;

alter table public.books add column if not exists cover_image_url text;
alter table public.books add column if not exists is_for_sale boolean not null default false;
alter table public.books add column if not exists price integer not null default 0;
alter table public.ratings add column if not exists review text not null default '';

-- Prevent invalid prices without changing existing free books.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'books_price_nonnegative') then
    alter table public.books add constraint books_price_nonnegative check (price >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'books_sale_min_price') then
    alter table public.books add constraint books_sale_min_price check (is_for_sale = false or price >= 1000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ratings_review_length') then
    alter table public.ratings add constraint ratings_review_length check (char_length(review) <= 1000);
  end if;
end $$;

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  proof_path text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(book_id, buyer_id),
  check (buyer_id <> seller_id)
);
create index if not exists purchases_seller_status_idx on public.purchases(seller_id, status, created_at desc);
create index if not exists purchases_buyer_idx on public.purchases(buyer_id, created_at desc);

alter table public.purchases enable row level security;
drop policy if exists "Buyer or seller can view purchase" on public.purchases;
create policy "Buyer or seller can view purchase" on public.purchases for select to authenticated
using ((select auth.uid()) = buyer_id or (select auth.uid()) = seller_id);
drop policy if exists "Buyer submits own purchase proof" on public.purchases;
create policy "Buyer submits own purchase proof" on public.purchases for insert to authenticated
with check (
  (select auth.uid()) = buyer_id
  and status = 'pending'
  and exists (select 1 from public.books b where b.id = book_id and b.user_id = seller_id and b.is_for_sale = true and b.price >= 1000)
);
drop policy if exists "Buyer can resubmit pending proof" on public.purchases;
create policy "Buyer can resubmit pending proof" on public.purchases for update to authenticated
using ((select auth.uid()) = buyer_id and status in ('pending','rejected'))
with check ((select auth.uid()) = buyer_id and status = 'pending');
drop policy if exists "Seller reviews own book purchases" on public.purchases;
create policy "Seller reviews own book purchases" on public.purchases for update to authenticated
using ((select auth.uid()) = seller_id)
with check ((select auth.uid()) = seller_id and status in ('approved','rejected'));

-- Public image bucket for profile photos, banners, book covers and QRIS images.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dp-assets','dp-assets',true,5242880,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public=true, file_size_limit=5242880, allowed_mime_types=array['image/jpeg','image/png','image/webp','image/gif'];

drop policy if exists "DP public images are readable" on storage.objects;
create policy "DP public images are readable" on storage.objects for select to public using (bucket_id = 'dp-assets');
drop policy if exists "Members upload own DP images" on storage.objects;
create policy "Members upload own DP images" on storage.objects for insert to authenticated
with check (bucket_id = 'dp-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Members update own DP images" on storage.objects;
create policy "Members update own DP images" on storage.objects for update to authenticated
using (bucket_id = 'dp-assets' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'dp-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Members delete own DP images" on storage.objects;
create policy "Members delete own DP images" on storage.objects for delete to authenticated
using (bucket_id = 'dp-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Private bucket for payment proofs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs','payment-proofs',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false, file_size_limit=5242880, allowed_mime_types=array['image/jpeg','image/png','image/webp'];
drop policy if exists "Buyers upload own payment proof" on storage.objects;
create policy "Buyers upload own payment proof" on storage.objects for insert to authenticated
with check (bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Buyer or seller reads payment proof" on storage.objects;
create policy "Buyer or seller reads payment proof" on storage.objects for select to authenticated
using (bucket_id = 'payment-proofs' and exists (
  select 1 from public.purchases p where p.proof_path = name
  and ((select auth.uid()) = p.buyer_id or (select auth.uid()) = p.seller_id)
));
drop policy if exists "Buyers replace own proof files" on storage.objects;
create policy "Buyers replace own proof files" on storage.objects for delete to authenticated
using (bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Replace the old broad PDF read policy. A signed-in user can read a free PDF,
-- the owner can read their own PDF, or a buyer can read after approval.
drop policy if exists "Signed-in users read PDFs" on storage.objects;
drop policy if exists "Signed in users read PDFs" on storage.objects;
drop policy if exists "Read free or purchased PDFs" on storage.objects;
create policy "Read free or purchased PDFs" on storage.objects for select to authenticated
using (
  bucket_id = 'book-pdfs' and exists (
    select 1 from public.books b
    where b.storage_path = name
      and (b.is_approved = true)
      and (
        b.is_for_sale = false
        or b.user_id = (select auth.uid())
        or exists (select 1 from public.purchases p where p.book_id = b.id and p.buyer_id = (select auth.uid()) and p.status = 'approved')
      )
  )
);

-- Ensure only the owner can upload PDF files into their own folder.
drop policy if exists "Users upload PDFs to own folder" on storage.objects;
create policy "Users upload PDFs to own folder" on storage.objects for insert to authenticated
with check (bucket_id = 'book-pdfs' and (storage.foldername(name))[1] = (select auth.uid())::text and lower(storage.extension(name)) = 'pdf');

-- Existing ratings table already allows one rating per member per book. The review
-- column above makes the written explanation optional; blank reviews still count.

-- Secure admin allow-list for managing the global website banner.
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
drop policy if exists "Members can check their own admin status" on public.admin_users;
create policy "Members can check their own admin status" on public.admin_users for select to authenticated
using ((select auth.uid()) = user_id);
-- No client insert/delete policies by design. Add/remove admins only from SQL Editor.

create table if not exists public.site_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
drop policy if exists "Site settings are publicly readable" on public.site_settings;
create policy "Site settings are publicly readable" on public.site_settings for select to anon, authenticated using (true);
drop policy if exists "Admins insert site settings" on public.site_settings;
create policy "Admins insert site settings" on public.site_settings for insert to authenticated
with check (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));
drop policy if exists "Admins update site settings" on public.site_settings;
create policy "Admins update site settings" on public.site_settings for update to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())))
with check (exists (select 1 from public.admin_users a where a.user_id = (select auth.uid())));

-- After running this migration, register your own account as admin from SQL Editor:
-- 1. Open Supabase Dashboard > Authentication > Users and copy your own user UUID.
-- 2. Replace YOUR_AUTH_USER_UUID below and run it as a separate query:
-- insert into public.admin_users (user_id) values ('YOUR_AUTH_USER_UUID') on conflict do nothing;
