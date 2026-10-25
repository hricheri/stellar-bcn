-- TATTOO SWAP: private data lives here, protected per user with Row Level
-- Security. Reputation, studios, published dates and bookings stay on Stellar.
--
-- Run it once in Supabase: SQL Editor -> New query -> paste -> Run.

-- ---------------------------------------------------------------------------
-- Profiles: one per account, linked to the artist's Stellar address
-- ---------------------------------------------------------------------------
create table public.profiles (
	id uuid primary key references auth.users (id) on delete cascade,
	stellar_address text unique,
	name text not null default '' check (char_length(name) <= 40),
	city text not null default '' check (char_length(city) <= 40),
	instagram text not null default '' check (char_length(instagram) <= 40),
	bio text not null default '' check (char_length(bio) <= 500),
	-- Path inside the private "photos" bucket
	avatar_path text,
	-- What I need at a studio (supply ids, same as the contract's amenities)
	wanted text[] not null default '{}',
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Only people with an account see profiles; nobody outside the app
create policy "members read profiles" on public.profiles
	for select to authenticated using (true);
create policy "own profile insert" on public.profiles
	for insert to authenticated with check (id = auth.uid());
create policy "own profile update" on public.profiles
	for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
-- The Stellar address is set once, through claim_my_address below
revoke insert, update on public.profiles from authenticated;
grant insert (id, name, city, instagram, bio, avatar_path, wanted) on public.profiles to authenticated;
grant update (name, city, instagram, bio, avatar_path, wanted) on public.profiles to authenticated;

-- Links the account to the Stellar address the app just created for it. It
-- can only be set once, and two accounts can never share an address.
create function public.claim_my_address(address text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
	if address !~ '^G[A-Z2-7]{55}$' then
		raise exception 'Not a Stellar address';
	end if;
	update public.profiles set stellar_address = address
		where id = auth.uid() and stellar_address is null;
end;
$$;

revoke all on function public.claim_my_address(text) from public, anon;
grant execute on function public.claim_my_address(text) to authenticated;

-- The Stellar secret key of each account, so changing phone or browser never
-- loses your profile. Only its owner can read it.
create table public.wallets (
	id uuid primary key references auth.users (id) on delete cascade,
	secret text not null,
	created_at timestamptz not null default now()
);

alter table public.wallets enable row level security;

create policy "own wallet" on public.wallets
	for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- Studio photos: studios live on Stellar, their photos here. Any artist can
-- upload one; the app only shows those uploaded by an artist of the studio.
-- ---------------------------------------------------------------------------
create table public.studio_photos (
	studio_id integer not null,
	uploaded_by uuid not null references public.profiles (id) on delete cascade,
	photo_path text not null,
	updated_at timestamptz not null default now(),
	primary key (studio_id, uploaded_by)
);

alter table public.studio_photos enable row level security;

create policy "members read studio photos" on public.studio_photos
	for select to authenticated using (true);
create policy "own studio photo" on public.studio_photos
	for all to authenticated using (uploaded_by = auth.uid())
	with check (uploaded_by = auth.uid());

-- ---------------------------------------------------------------------------
-- Trips: the days I'd like to travel (from the Calendar)
-- ---------------------------------------------------------------------------
create table public.trips (
	id bigint generated always as identity primary key,
	user_id uuid not null references public.profiles (id) on delete cascade,
	start_date date not null,
	end_date date not null check (end_date >= start_date),
	city text not null default '' check (char_length(city) <= 40),
	created_at timestamptz not null default now()
);

create index trips_user on public.trips (user_id);
alter table public.trips enable row level security;

create policy "members read trips" on public.trips
	for select to authenticated using (true);
create policy "own trips" on public.trips
	for all to authenticated using (user_id = auth.uid())
	with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Likes (favorites). You see your likes and who liked you, nobody else's.
-- ---------------------------------------------------------------------------
create table public.likes (
	liker uuid not null references public.profiles (id) on delete cascade,
	liked uuid not null references public.profiles (id) on delete cascade,
	created_at timestamptz not null default now(),
	primary key (liker, liked),
	check (liker <> liked)
);

create index likes_liked on public.likes (liked);
alter table public.likes enable row level security;

create policy "see my likes" on public.likes
	for select to authenticated using (liker = auth.uid() or liked = auth.uid());
create policy "like" on public.likes
	for insert to authenticated with check (liker = auth.uid());
create policy "unlike" on public.likes
	for delete to authenticated using (liker = auth.uid());

-- ---------------------------------------------------------------------------
-- Visit requests: "I want to visit!" to a studio without dates (or with)
-- ---------------------------------------------------------------------------
create table public.visit_requests (
	id bigint generated always as identity primary key,
	guest uuid not null references public.profiles (id) on delete cascade,
	-- The studio artist it goes to
	host uuid not null references public.profiles (id) on delete cascade,
	studio_id integer not null,
	message text not null default '' check (char_length(message) <= 500),
	-- Optional: the dates the guest has in mind
	start_date date,
	end_date date,
	status text not null default 'open' check (status in ('open', 'answered', 'closed')),
	created_at timestamptz not null default now(),
	check (guest <> host)
);

create index visit_requests_host on public.visit_requests (host);
create index visit_requests_guest on public.visit_requests (guest);
alter table public.visit_requests enable row level security;

create policy "see my requests" on public.visit_requests
	for select to authenticated using (guest = auth.uid() or host = auth.uid());
create policy "send request" on public.visit_requests
	for insert to authenticated with check (guest = auth.uid());
-- Either side can only change its status (answered, closed)
create policy "update my requests" on public.visit_requests
	for update to authenticated using (guest = auth.uid() or host = auth.uid());
revoke update on public.visit_requests from authenticated;
grant update (status) on public.visit_requests to authenticated;

-- ---------------------------------------------------------------------------
-- Chat: private, only the two people in it can read it
-- ---------------------------------------------------------------------------
create table public.messages (
	id bigint generated always as identity primary key,
	sender uuid not null references public.profiles (id) on delete cascade,
	recipient uuid not null references public.profiles (id) on delete cascade,
	body text not null check (char_length(body) between 1 and 1000),
	created_at timestamptz not null default now(),
	read_at timestamptz,
	check (sender <> recipient)
);

create index messages_pair on public.messages (least(sender, recipient), greatest(sender, recipient), created_at);
create index messages_recipient on public.messages (recipient, read_at);
alter table public.messages enable row level security;

create policy "read my chats" on public.messages
	for select to authenticated using (sender = auth.uid() or recipient = auth.uid());
create policy "send message" on public.messages
	for insert to authenticated with check (sender = auth.uid());
-- Only the recipient can mark a message as read, and nothing else changes
create policy "mark read" on public.messages
	for update to authenticated using (recipient = auth.uid());
revoke update on public.messages from authenticated;
grant update (read_at) on public.messages to authenticated;

alter publication supabase_realtime add table public.messages;

-- ---------------------------------------------------------------------------
-- Photos bucket: private. Members of the app can view; each person only
-- writes inside their own folder ({user id}/...).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

create policy "members view photos" on storage.objects
	for select to authenticated using (bucket_id = 'photos');
create policy "upload own photos" on storage.objects
	for insert to authenticated
	with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "replace own photos" on storage.objects
	for update to authenticated
	using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own photos" on storage.objects
	for delete to authenticated
	using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Delete my account (required by the App Store). Removes the login and, by
-- cascade, everything above. The app deletes the photos first through the
-- Storage API. Reviews on Stellar stay, as they're public.
-- ---------------------------------------------------------------------------
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
	delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Keep updated_at fresh
create function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
	new.updated_at = now();
	return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
	for each row execute function public.touch_updated_at();
