-- Lyrics, playlist folder, and stable local-folder key for re-sync.

alter table public.songs
  add column if not exists lyrics text,
  add column if not exists playlist_id text not null default '',
  add column if not exists source_key text,
  add column if not exists genre text not null default '',
  add column if not exists explicit boolean not null default false;

create unique index if not exists songs_user_source_key_idx
  on public.songs (user_id, source_key)
  where source_key is not null;
