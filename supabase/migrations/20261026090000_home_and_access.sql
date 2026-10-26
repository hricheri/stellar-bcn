-- TATTOO APP: the home (photo and description) and the access instructions.
--
-- Access instructions (how to get in, door photos...) are private: only
-- their owner and guests with a confirmed stay can read them. Stays are
-- confirmed on Stellar, so the host's app writes an access_grants row for
-- each confirmed guest, valid until the stay ends.

-- ---------------------------------------------------------------------------
-- Home: what other members see when you offer it
-- ---------------------------------------------------------------------------
alter table public.profiles
	add column home_description text not null default ''
		check (char_length(home_description) <= 800),
	add column home_photo_path text;

grant insert (home_description, home_photo_path) on public.profiles to authenticated;
grant update (home_description, home_photo_path) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Who can see my access instructions, and until when
-- ---------------------------------------------------------------------------
create table public.access_grants (
	owner uuid not null default auth.uid() references public.profiles (id) on delete cascade,
	guest uuid not null references public.profiles (id) on delete cascade,
	until date not null,
	primary key (owner, guest),
	check (owner <> guest)
);

alter table public.access_grants enable row level security;

create policy "see grants" on public.access_grants
	for select to authenticated using (owner = auth.uid() or guest = auth.uid());
create policy "grant access" on public.access_grants
	for insert to authenticated with check (owner = auth.uid());
create policy "change grant" on public.access_grants
	for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy "revoke grant" on public.access_grants
	for delete to authenticated using (owner = auth.uid());

-- true when owner gave me access and the stay hasn't ended (one day margin)
-- (owner as text, because storage folder names are text)
create function public.has_access(owner text) returns boolean
language sql stable security definer set search_path = '' as $$
	select exists (
		select 1 from public.access_grants g
		where g.owner::text = has_access.owner
			and g.guest = auth.uid()
			and g.until >= current_date - 1
	)
$$;

revoke all on function public.has_access(text) from public, anon;
grant execute on function public.has_access(text) to authenticated;

-- ---------------------------------------------------------------------------
-- The instructions themselves (studio and home) and their photos
-- ---------------------------------------------------------------------------
create table public.access_info (
	owner uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
	studio_text text not null default '' check (char_length(studio_text) <= 2000),
	home_text text not null default '' check (char_length(home_text) <= 2000),
	-- Paths inside the private "access" bucket
	photo_paths text[] not null default '{}',
	updated_at timestamptz not null default now()
);

alter table public.access_info enable row level security;

create policy "read access info" on public.access_info
	for select to authenticated using (owner = auth.uid() or public.has_access(owner::text));
create policy "write my access info" on public.access_info
	for insert to authenticated with check (owner = auth.uid());
create policy "update my access info" on public.access_info
	for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());

create trigger access_info_updated before update on public.access_info
	for each row execute function public.touch_updated_at();

-- A separate private bucket: unlike profile photos, other members can't
-- open these, only confirmed guests.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('access', 'access', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

create policy "view access photos" on storage.objects
	for select to authenticated
	using (
		bucket_id = 'access'
		and (
			(storage.foldername(name))[1] = auth.uid()::text
			or public.has_access((storage.foldername(name))[1])
		)
	);
create policy "upload own access photos" on storage.objects
	for insert to authenticated
	with check (bucket_id = 'access' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "replace own access photos" on storage.objects
	for update to authenticated
	using (bucket_id = 'access' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own access photos" on storage.objects
	for delete to authenticated
	using (bucket_id = 'access' and (storage.foldername(name))[1] = auth.uid()::text);

-- Confirmed guests can also read the studio's exact address
create policy "guests read studio address" on public.studio_addresses
	for select to authenticated using (public.has_access(set_by::text));
