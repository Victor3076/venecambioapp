-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. PROFILES (Extends Supabase Auth)
create table public.profiles (
  id uuid references auth.users not null primary key,
  email text,
  full_name text,
  role text default 'user' check (role in ('user', 'admin')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for Profiles
alter table public.profiles enable row level security;
create policy "Public profiles are viewable by everyone." on public.profiles for select using (true);
create policy "Users can insert their own profile." on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile." on public.profiles for update using (auth.uid() = id);

-- 2. RATES CONFIGURATION (Stores the single source of truth for rates)
create table public.rates_configuration (
  id uuid default uuid_generate_v4() primary key,
  usdt_prices jsonb not null default '{}'::jsonb, -- e.g. {"USA": 1.0, "PERU": 3.75}
  margins jsonb not null default '{}'::jsonb,     -- e.g. {"PEN_VES": 5.0}
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_by uuid references public.profiles(id)
);

-- RLS for Rates
alter table public.rates_configuration enable row level security;
create policy "Rates are viewable by everyone." on public.rates_configuration for select using (true);
create policy "Only admins can update rates." on public.rates_configuration for all using (
  exists ( select 1 from public.profiles where id = auth.uid() and role = 'admin' )
);

-- 3. USER ACCOUNTS (Saved beneficiaries)
create table public.user_accounts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) not null,
  alias text not null, -- "Maria Banesco"
  country text not null, -- "Venezuela", "Peru"
  bank_name text not null,
  account_number text,
  details jsonb, -- Extra info like CCI, Email, ID number
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for Accounts
alter table public.user_accounts enable row level security;
create policy "Users can allow view own accounts." on public.user_accounts for select using (auth.uid() = user_id);
create policy "Users can insert own accounts." on public.user_accounts for insert with check (auth.uid() = user_id);
create policy "Users can update own accounts." on public.user_accounts for update using (auth.uid() = user_id);
create policy "Users can delete own accounts." on public.user_accounts for delete using (auth.uid() = user_id);

-- 4. TRANSACTIONS (Operations)
create table public.transactions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) not null,
  status text default 'verifying' check (status in ('verifying', 'verified', 'completed', 'rejected')),
  
  -- Amounts
  amount_sent numeric not null,
  currency_sent text not null, -- "CLP", "PEN"
  amount_received numeric not null,
  currency_received text not null, -- "VES"
  exchange_rate numeric not null, -- The rate used at that moment
  
  -- Proofs
  reference_id text, -- Bank reference
  payment_proof_url text, -- Supabase Storage URL
  
  -- Timestamps
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- RLS for Transactions
alter table public.transactions enable row level security;
create policy "Users can view own transactions." on public.transactions for select using (auth.uid() = user_id);
create policy "Admins can view all transactions." on public.transactions for select using (
  exists ( select 1 from public.profiles where id = auth.uid() and role = 'admin' )
);
create policy "Users can insert own transactions." on public.transactions for insert with check (auth.uid() = user_id);
create policy "Admins can update transactions." on public.transactions for update using (
  exists ( select 1 from public.profiles where id = auth.uid() and role = 'admin' )
);

-- Function to handle new user signup automatically
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, client_code, role)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'client_code', 'user');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for new user
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Initial Seed for Rates (Optional)
insert into public.rates_configuration (usdt_prices, margins)
values (
  '{"USA": 1.0, "PERU": 3.75, "CHILE": 980, "COLOMBIA": 3900, "VENEZUELA": 38.5, "MONITOR": 40.5, "BCV": 39.2}'::jsonb,
  '{"PEN_VES": 5.0, "CLP_VES": 7.0, "COP_VES": 10.0, "USA_VES": 3.0, "GENERIC": 2.0}'::jsonb
);
