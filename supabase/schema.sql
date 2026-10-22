-- =========================================================
-- Mercado Mundoloco · esquema para Supabase
-- Pegá TODO esto en Supabase → SQL Editor → New query → Run
-- =========================================================

-- 1) Perfiles (nombre + WhatsApp de cada empleado)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null default '',
  whatsapp text not null default '',
  created_at timestamptz not null default now()
);

-- se crea solo cuando alguien se registra
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nombre, whatsapp)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
          coalesce(new.raw_user_meta_data->>'whatsapp', ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2) Productos
create table if not exists public.productos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  vendedor_nombre text not null default '',
  titulo text not null check (char_length(titulo) between 3 and 80),
  descripcion text default '',
  categoria text not null default 'otros',
  estado text not null default 'usado' check (estado in ('nuevo','como nuevo','usado')),
  precio numeric not null check (precio > 0),
  moneda text not null default 'ARS' check (moneda in ('ARS','USD')),
  ml_url text,
  ml_precio numeric,
  ml_moneda text not null default 'ARS' check (ml_moneda in ('ARS','USD')),
  fotos text[] not null default '{}',
  status text not null default 'disponible' check (status in ('disponible','reservado','vendido')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists productos_created_idx on public.productos (created_at desc);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists productos_touch on public.productos;
create trigger productos_touch before update on public.productos
  for each row execute function public.touch_updated_at();

-- 3) Seguridad (RLS)
alter table public.profiles enable row level security;
alter table public.productos enable row level security;

-- Perfiles (con el WhatsApp): solo los ve gente con cuenta. Cada uno edita el suyo.
drop policy if exists "perfiles visibles para usuarios" on public.profiles;
create policy "perfiles visibles para usuarios" on public.profiles
  for select to authenticated using (true);
drop policy if exists "cada uno edita su perfil" on public.profiles;
create policy "cada uno edita su perfil" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Productos: el catálogo se ve sin cuenta (anon). Si querés que sea solo con
-- cuenta, cambiá "to anon, authenticated" por "to authenticated" y en
-- js/config.js poné REQUIRE_LOGIN_TO_VIEW: true.
drop policy if exists "catalogo visible" on public.productos;
create policy "catalogo visible" on public.productos
  for select to anon, authenticated using (true);
drop policy if exists "publicar propio" on public.productos;
create policy "publicar propio" on public.productos
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "editar propio" on public.productos;
create policy "editar propio" on public.productos
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "borrar propio" on public.productos;
create policy "borrar propio" on public.productos
  for delete to authenticated using (auth.uid() = user_id);

-- 4) Fotos (Storage): bucket público "fotos", cada uno sube en su carpeta
insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', true)
on conflict (id) do update set public = true;

drop policy if exists "fotos: subir propias" on storage.objects;
create policy "fotos: subir propias" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "fotos: borrar propias" on storage.objects;
create policy "fotos: borrar propias" on storage.objects
  for delete to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);
