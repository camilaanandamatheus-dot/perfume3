-- ============================================================
-- PERFUMARIA SUTAN — BANCO COMPLETO
-- Execute este arquivo UMA VEZ no SQL Editor do Supabase.
-- Pode executar novamente: os comandos principais são idempotentes.
-- ============================================================

create extension if not exists pgcrypto;

-- =========================
-- PERFIS / CONTAS
-- =========================
create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text not null,
    full_name text not null default 'Cliente Sutan',
    role text not null default 'customer' check (role in ('customer','admin')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    last_login_at timestamptz
);

create unique index if not exists profiles_email_lower_idx on public.profiles(lower(email));
create index if not exists profiles_role_idx on public.profiles(role);

-- Cria um perfil automaticamente quando um usuário nasce no Supabase Auth.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles(id, email, full_name, role, created_at, updated_at)
    values (
        new.id,
        coalesce(new.email, ''),
        coalesce(nullif(new.raw_user_meta_data->>'full_name',''), 'Cliente Sutan'),
        case when coalesce(new.raw_app_meta_data->>'role','') = 'admin' then 'admin' else 'customer' end,
        now(),
        now()
    )
    on conflict (id) do update set
        email = excluded.email,
        full_name = excluded.full_name,
        role = excluded.role,
        updated_at = now();
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of email, raw_user_meta_data, raw_app_meta_data on auth.users
for each row execute function public.handle_new_auth_user();

-- =========================
-- PEDIDOS
-- =========================
create table if not exists public.orders (
    id uuid primary key default gen_random_uuid(),
    order_code text not null unique,
    user_id uuid references auth.users(id) on delete set null,
    customer_email text not null,
    customer_name text not null default 'Cliente Sutan',
    status text not null default 'novo' check (status in ('novo','confirmado','concluido','cancelado')),
    total numeric(12,2) not null check (total >= 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists orders_user_id_idx on public.orders(user_id);
create index if not exists orders_created_at_idx on public.orders(created_at desc);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists orders_code_idx on public.orders(order_code);

create table if not exists public.order_items (
    id bigint generated always as identity primary key,
    order_id uuid not null references public.orders(id) on delete cascade,
    product_id integer not null,
    product_name text not null,
    unit_price numeric(12,2) not null check (unit_price >= 0),
    quantity integer not null check (quantity > 0 and quantity <= 20),
    subtotal numeric(12,2) not null check (subtotal >= 0)
);

create index if not exists order_items_order_id_idx on public.order_items(order_id);

-- =========================
-- VISITANTES
-- =========================
create table if not exists public.visitors (
    visitor_id text primary key,
    first_seen timestamptz not null default now(),
    last_seen timestamptz not null default now(),
    visit_count bigint not null default 1 check (visit_count > 0)
);

create index if not exists visitors_last_seen_idx on public.visitors(last_seen desc);

-- =========================
-- SEGURANÇA
-- =========================
alter table public.profiles enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.visitors enable row level security;

-- O navegador não acessa as tabelas diretamente. Tudo passa pelas APIs.
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.orders from anon, authenticated;
revoke all on table public.order_items from anon, authenticated;
revoke all on table public.visitors from anon, authenticated;

-- =========================
-- VISITAS ATÔMICAS
-- =========================
create or replace function public.register_visit(p_visitor_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if p_visitor_id is null or length(trim(p_visitor_id)) < 8 then
        return;
    end if;

    insert into public.visitors(visitor_id, first_seen, last_seen, visit_count)
    values (left(trim(p_visitor_id), 120), now(), now(), 1)
    on conflict (visitor_id)
    do update set
        last_seen = now(),
        visit_count = public.visitors.visit_count + 1;
end;
$$;

-- =========================
-- MÉTRICAS ADMIN
-- =========================
create or replace function public.admin_dashboard_metrics()
returns table (
    unique_visitors bigint,
    total_visits bigint,
    visitors_today bigint,
    registered_users bigint,
    orders_count bigint,
    new_orders_count bigint,
    total_order_value numeric
)
language sql
security definer
set search_path = public
as $$
    select
        (select count(*) from public.visitors)::bigint,
        coalesce((select sum(visit_count) from public.visitors), 0)::bigint,
        (select count(*) from public.visitors where last_seen >= date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')::bigint,
        (select count(*) from public.profiles)::bigint,
        (select count(*) from public.orders)::bigint,
        (select count(*) from public.orders where status = 'novo')::bigint,
        coalesce((select sum(total) from public.orders), 0)::numeric;
$$;

revoke all on function public.register_visit(text) from public, anon, authenticated;
revoke all on function public.admin_dashboard_metrics() from public, anon, authenticated;
grant execute on function public.register_visit(text) to service_role;
grant execute on function public.admin_dashboard_metrics() to service_role;

-- Garante que usuários já existentes também tenham perfil.
insert into public.profiles(id, email, full_name, role, created_at, updated_at)
select
    u.id,
    coalesce(u.email, ''),
    coalesce(nullif(u.raw_user_meta_data->>'full_name',''), 'Cliente Sutan'),
    case when coalesce(u.raw_app_meta_data->>'role','') = 'admin' then 'admin' else 'customer' end,
    coalesce(u.created_at, now()),
    now()
from auth.users u
on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    role = excluded.role,
    updated_at = now();
