-- Helper function to check admin role reliably bypassing potential RLS on profiles
create or replace function public.is_admin_check()
returns boolean
language plpgsql security definer
as $$
begin
  return exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role = 'admin'
  );
end;
$$;

-- Drop existing policies on bank_deposits to redefine them
drop policy if exists "Admins can view all deposits" on public.bank_deposits;
drop policy if exists "Admins can insert deposits" on public.bank_deposits;
drop policy if exists "Admins can update deposits" on public.bank_deposits;

-- Re-create policies using the secure helper function
create policy "Admins can view all deposits"
    on public.bank_deposits for select
    using ( public.is_admin_check() );

create policy "Admins can insert deposits"
    on public.bank_deposits for insert
    with check ( public.is_admin_check() );

create policy "Admins can update deposits"
    on public.bank_deposits for update
    using ( public.is_admin_check() );
