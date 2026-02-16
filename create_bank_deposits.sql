-- Create bank_deposits table
create table if not exists public.bank_deposits (
    id uuid default gen_random_uuid() primary key,
    amount numeric not null,
    currency text not null, -- 'VES', 'USD', etc.
    reference_number text, -- Bank reference
    bank_name text,
    status text default 'available' check (status in ('available', 'matched')),
    matched_transaction_id uuid references public.transactions(id),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add index for faster searching
create index if not exists bank_deposits_status_idx on public.bank_deposits (status);
create index if not exists bank_deposits_reference_idx on public.bank_deposits (reference_number);

-- Enable RLS
alter table public.bank_deposits enable row level security;

-- Policies
-- Admins can view all deposits
create policy "Admins can view all deposits"
    on public.bank_deposits for select
    using ( exists ( select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin' ) );

-- Admins can insert deposits
create policy "Admins can insert deposits"
    on public.bank_deposits for insert
    with check ( exists ( select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin' ) );

-- Admins can update deposits
create policy "Admins can update deposits"
    on public.bank_deposits for update
    using ( exists ( select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin' ) );
