-- TATTOO APP: where each studio is.
--
-- studio_places: the general area (rounded to ~1 km), for the map on the
-- cards. Every signed-in artist can see it.
-- studio_addresses: the exact address, only for the artist who wrote it.
-- Guests get it in the chat once their stay is confirmed.
--
-- Studios live on Stellar, so a row is keyed by the studio and the artist who
-- set it; the app only shows rows set by members of the studio.

create table public.studio_places (
	studio_id integer not null,
	set_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
	area text not null default '' check (char_length(area) <= 120),
	lat double precision not null check (lat between -90 and 90),
	lng double precision not null check (lng between -180 and 180),
	updated_at timestamptz not null default now(),
	primary key (studio_id, set_by)
);

alter table public.studio_places enable row level security;

create policy "members see areas" on public.studio_places
	for select to authenticated using (true);
create policy "set my studio area" on public.studio_places
	for insert to authenticated with check (set_by = auth.uid());
create policy "update my studio area" on public.studio_places
	for update to authenticated using (set_by = auth.uid()) with check (set_by = auth.uid());
create policy "delete my studio area" on public.studio_places
	for delete to authenticated using (set_by = auth.uid());

-- Only ~1 km precision is ever stored here
create function public.round_studio_place() returns trigger
language plpgsql set search_path = '' as $$
begin
	new.lat := round(new.lat::numeric, 2);
	new.lng := round(new.lng::numeric, 2);
	new.updated_at := now();
	return new;
end;
$$;

create trigger round_studio_place before insert or update on public.studio_places
	for each row execute function public.round_studio_place();

create table public.studio_addresses (
	studio_id integer not null,
	set_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
	address text not null check (char_length(address) between 3 and 300),
	lat double precision not null,
	lng double precision not null,
	updated_at timestamptz not null default now(),
	primary key (studio_id, set_by)
);

alter table public.studio_addresses enable row level security;

create policy "my studio addresses" on public.studio_addresses
	for all to authenticated using (set_by = auth.uid()) with check (set_by = auth.uid());
