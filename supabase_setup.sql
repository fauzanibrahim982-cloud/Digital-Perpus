-- DIGITAL PERPUS — Supabase SQL setup
-- Run the entire script in Supabase Dashboard > SQL Editor > New query.
-- Storage bucket: book-pdfs (private; 10 MB max; application/pdf only).

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Pembaca' check (char_length(display_name) between 1 and 40),
  avatar text not null default '👤',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  author text not null check (char_length(author) between 1 and 100),
  category text not null default 'Umum',
  description text not null default '' check (char_length(description) <= 500),
  storage_path text not null unique,
  cover_emoji text not null default '📄',
  cover_style smallint not null default 1 check (cover_style between 1 and 6),
  is_approved boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

create table if not exists public.ratings (
  user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

create index if not exists books_created_at_idx on public.books(created_at desc);
create index if not exists books_title_idx on public.books(title);
create index if not exists favorites_user_id_idx on public.favorites(user_id);
create index if not exists ratings_book_id_idx on public.ratings(book_id);

alter table public.profiles enable row level security;
alter table public.books enable row level security;
alter table public.favorites enable row level security;
alter table public.ratings enable row level security;

drop policy if exists "Profiles are viewable by everyone" on public.profiles;
create policy "Profiles are viewable by everyone" on public.profiles for select to authenticated using (true);
drop policy if exists "Users insert own profile" on public.profiles;
create policy "Users insert own profile" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "Approved books visible to signed-in users" on public.books;
create policy "Approved books visible to signed-in users" on public.books for select to authenticated using (is_approved = true or (select auth.uid()) = user_id);
drop policy if exists "Users upload own book metadata" on public.books;
create policy "Users upload own book metadata" on public.books for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users update own books" on public.books;
create policy "Users update own books" on public.books for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users delete own books" on public.books;
create policy "Users delete own books" on public.books for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users view own favorites" on public.favorites;
create policy "Users view own favorites" on public.favorites for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users add own favorites" on public.favorites;
create policy "Users add own favorites" on public.favorites for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users remove own favorites" on public.favorites;
create policy "Users remove own favorites" on public.favorites for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Ratings visible to signed-in users" on public.ratings;
create policy "Ratings visible to signed-in users" on public.ratings for select to authenticated using (true);
drop policy if exists "Users create own ratings" on public.ratings;
create policy "Users create own ratings" on public.ratings for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users update own ratings" on public.ratings;
create policy "Users update own ratings" on public.ratings for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users delete own ratings" on public.ratings;
create policy "Users delete own ratings" on public.ratings for delete to authenticated using ((select auth.uid()) = user_id);

-- Create a PRIVATE bucket. Signed URLs are issued by the app only after login.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('book-pdfs', 'book-pdfs', false, 10485760, array['application/pdf'])
on conflict (id) do update set public=false, file_size_limit=10485760, allowed_mime_types=array['application/pdf'];

drop policy if exists "Signed-in users read PDFs" on storage.objects;
create policy "Signed-in users read PDFs" on storage.objects for select to authenticated
using (bucket_id = 'book-pdfs');

drop policy if exists "Users upload PDFs to own folder" on storage.objects;
create policy "Users upload PDFs to own folder" on storage.objects for insert to authenticated
with check (bucket_id = 'book-pdfs' and (storage.foldername(name))[1] = (select auth.uid())::text and lower(storage.extension(name)) = 'pdf');

drop policy if exists "Users update own PDFs" on storage.objects;
create policy "Users update own PDFs" on storage.objects for update to authenticated
using (bucket_id = 'book-pdfs' and owner_id = (select auth.uid())::text)
with check (bucket_id = 'book-pdfs' and owner_id = (select auth.uid())::text);

drop policy if exists "Users delete own PDFs" on storage.objects;
create policy "Users delete own PDFs" on storage.objects for delete to authenticated
using (bucket_id = 'book-pdfs' and owner_id = (select auth.uid())::text);

-- Create profile rows automatically after signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1), 'Pembaca'),
    '👤'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
