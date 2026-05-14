-- Run via Supabase SQL editor or `supabase db push` after linking the project.

create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  artist text not null default '',
  album text not null default '',
  release_year integer,
  audio_storage_path text not null,
  artwork_storage_path text,
  duration_seconds double precision,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists songs_user_id_sort_idx on public.songs (user_id, sort_order);

alter table public.songs enable row level security;

create policy "songs_select_own" on public.songs for select using (auth.uid() = user_id);

create policy "songs_insert_own" on public.songs for insert
with
  check (auth.uid() = user_id);

create policy "songs_update_own" on public.songs
for update
  using (auth.uid() = user_id)
with
  check (auth.uid() = user_id);

create policy "songs_delete_own" on public.songs for delete using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('tracks', 'tracks', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('track-artwork', 'track-artwork', false)
on conflict (id) do nothing;

-- Allow authenticated users to manage objects under their user_id prefix
create policy "tracks_select_own"
on storage.objects for select to authenticated using (
  bucket_id = 'tracks'
  and (string_to_array (name, '/'))[1] = auth.uid()::text
);

create policy "tracks_insert_own"
on storage.objects for insert to authenticated
with
  check (
    bucket_id = 'tracks'
    and (string_to_array (name, '/'))[1] = auth.uid()::text
  );

create policy "tracks_update_own"
on storage.objects
for update
  to authenticated using (
    bucket_id = 'tracks'
    and (string_to_array (name, '/'))[1] = auth.uid()::text
  )
with
  check (
    bucket_id = 'tracks'
    and (string_to_array (name, '/'))[1] = auth.uid()::text
  );

create policy "tracks_delete_own"
on storage.objects for delete to authenticated using (
  bucket_id = 'tracks'
  and (string_to_array (name, '/'))[1] = auth.uid()::text
);

create policy "art_select_own"
on storage.objects for select to authenticated using (
  bucket_id = 'track-artwork'
  and (string_to_array (name, '/'))[1] = auth.uid()::text
);

create policy "art_insert_own"
on storage.objects for insert to authenticated
with
  check (
    bucket_id = 'track-artwork'
    and (string_to_array (name, '/'))[1] = auth.uid()::text
  );

create policy "art_update_own"
on storage.objects
for update
  to authenticated using (
    bucket_id = 'track-artwork'
    and (string_to_array (name, '/'))[1] = auth.uid()::text
  )
with
  check (
    bucket_id = 'track-artwork'
    and (string_to_array (name, '/'))[1] = auth.uid()::text
  );

create policy "art_delete_own"
on storage.objects for delete to authenticated using (
  bucket_id = 'track-artwork'
  and (string_to_array (name, '/'))[1] = auth.uid()::text
);
