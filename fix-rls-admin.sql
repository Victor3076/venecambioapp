-- Ajuste de RLS para Profiles para permitir lectura por parte de Admins (o pública para simplificar el join)
-- El error {} usualmente ocurre cuando una política de RLS bloquea una parte de un JOIN silenciosamente en Supabase.

-- Primero, eliminamos la política restrictiva si existe (o la complementamos)
drop policy if exists "Public profiles are viewable by everyone." on public.profiles;

-- Nueva política: Cualquier usuario autenticado puede ver perfiles (necesario para el join de transacciones)
create policy "Profiles are viewable by authenticated users" on public.profiles
for select to authenticated using (true);

-- Asegurar que las transacciones también permitan lectura a Admins correctamente
drop policy if exists "Admins can view all transactions." on public.transactions;

create policy "Admins can view all transactions" on public.transactions
for select to authenticated
using (
  exists (
    select 1 from public.profiles
    where id = auth.uid()
    and role = 'admin'
  )
);
