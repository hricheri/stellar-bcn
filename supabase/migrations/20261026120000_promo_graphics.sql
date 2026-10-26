-- TATTOO APP: the guest artist graphics of each stay ("Guest spot in
-- Barcelona, 10-30 Nov"). Each artist uploads up to 5 per stay; the other
-- artist of the stay can see and download them. They stay saved, for the
-- album of past trips.

create table public.promo_graphics (
	id bigint generated always as identity primary key,
	-- The stay on Stellar
	booking_id integer not null,
	owner uuid not null default auth.uid() references public.profiles (id) on delete cascade,
	-- The other artist of the stay
	shared_with uuid not null references public.profiles (id) on delete cascade,
	city text not null default '' check (char_length(city) <= 80),
	-- Path inside the private "promos" bucket
	path text not null unique,
	created_at timestamptz not null default now(),
	check (owner <> shared_with)
);

create index promo_graphics_booking on public.promo_graphics (booking_id);

alter table public.promo_graphics enable row level security;

-- How many graphics I already have for a stay (definer: no policy loop)
create function public.my_promo_count(booking integer) returns integer
language sql stable security definer set search_path = '' as $$
	select count(*)::integer from public.promo_graphics
	where owner = auth.uid() and booking_id = booking
$$;

revoke all on function public.my_promo_count(integer) from public, anon;
grant execute on function public.my_promo_count(integer) to authenticated;

create policy "see my stay graphics" on public.promo_graphics
	for select to authenticated
	using (owner = auth.uid() or shared_with = auth.uid());
create policy "add a graphic, 5 per stay" on public.promo_graphics
	for insert to authenticated
	with check (
		owner = auth.uid()
		and (storage.foldername(path))[1] = auth.uid()::text
		and public.my_promo_count(booking_id) < 5
	);
create policy "remove my graphic" on public.promo_graphics
	for delete to authenticated using (owner = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('promos', 'promos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp']);

create policy "view stay graphics" on storage.objects
	for select to authenticated
	using (
		bucket_id = 'promos'
		and (
			(storage.foldername(name))[1] = auth.uid()::text
			or exists (
				select 1 from public.promo_graphics g
				where g.path = name and g.shared_with = auth.uid()
			)
		)
	);
create policy "upload own graphics" on storage.objects
	for insert to authenticated
	with check (bucket_id = 'promos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own graphics" on storage.objects
	for delete to authenticated
	using (bucket_id = 'promos' and (storage.foldername(name))[1] = auth.uid()::text);
