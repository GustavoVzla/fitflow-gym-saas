-- =============================================================================
-- FitFlow — Row Level Security Policies
-- =============================================================================
-- Estrategia:
--   1. RLS activo en TODAS las tablas (deny by default)
--   2. Acceso basado en private.current_user_gym_ids() (helper SECURITY DEFINER)
--   3. Separamos policies SELECT / INSERT / UPDATE / DELETE (más claro y auditable)
--   4. Roles elevados (owner, admin) tienen permisos extra (ej: modificar gym settings)
--   5. Performance: usamos (select auth.uid()) — cached, no re-evaluado por fila
--
-- Principio: ningún user puede leer/escribir datos de un gym al que NO pertenezca.
-- =============================================================================

-- =============================================================================
-- ENABLE RLS en todas las tablas
-- =============================================================================

alter table public.gyms enable row level security;
alter table public.gym_users enable row level security;
alter table public.gym_settings enable row level security;
alter table public.instructors enable row level security;
alter table public.tariffs enable row level security;
alter table public.members enable row level security;
alter table public.member_tariffs enable row level security;
alter table public.classes enable row level security;
alter table public.class_instances enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.notifications enable row level security;
alter table public.tasks enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.offers enable row level security;
alter table public.workouts enable row level security;
alter table public.competitions enable row level security;
alter table public.shop_products enable row level security;
alter table public.shop_orders enable row level security;
alter table public.posts enable row level security;
alter table public.reports_snapshots enable row level security;
alter table public.audit_log enable row level security;

-- =============================================================================
-- 1. GYMS — el user solo ve los gyms a los que pertenece
-- =============================================================================

-- SELECT: user puede ver sus gyms
create policy "Users can view their gyms"
  on public.gyms for select
  to authenticated
  using (id in (select private.current_user_gym_ids()));

-- INSERT: PROHIBIDO via API directo. El canal oficial es el RPC public.create_gym_with_owner
-- (SECURITY DEFINER que bypassea RLS de forma controlada y crea gym+settings+owner atómicamente).
-- Sin policy INSERT = deny by default.

-- UPDATE: solo owner/admin del gym puede modificarlo
create policy "Owners/admins can update their gym"
  on public.gyms for update
  to authenticated
  using (private.is_gym_admin(id))
  with check (private.is_gym_admin(id));

-- DELETE: solo owner (soft delete vía status, no DELETE físico recomendado)
create policy "Only owners can delete their gym"
  on public.gyms for delete
  to authenticated
  using (private.user_role_in_gym(id) in ('super_admin', 'owner'));

-- =============================================================================
-- 2. GYM_USERS — gestión de membresías
-- =============================================================================

-- SELECT: un user ve las filas de gym_users de los gyms a los que pertenece
create policy "Users can view memberships of their gyms"
  on public.gym_users for select
  to authenticated
  using (gym_id in (select private.current_user_gym_ids()));

-- INSERT: solo owner/admin puede invitar nuevos users al gym
-- EXCEPCIÓN: al crear un gym nuevo, el creator debe poder insertarse como owner.
-- Esto se maneja con trigger/función, no con policy (ver 0003_functions.sql).
create policy "Owners/admins can add users to their gym"
  on public.gym_users for insert
  to authenticated
  with check (private.is_gym_admin(gym_id));

-- UPDATE: solo owner/admin puede cambiar roles
create policy "Owners/admins can update memberships"
  on public.gym_users for update
  to authenticated
  using (private.is_gym_admin(gym_id))
  with check (private.is_gym_admin(gym_id));

-- DELETE: solo owner/admin puede remover users
create policy "Owners/admins can remove memberships"
  on public.gym_users for delete
  to authenticated
  using (private.is_gym_admin(gym_id));

-- =============================================================================
-- 3. GYM_SETTINGS
-- =============================================================================

create policy "Members can view gym settings"
  on public.gym_settings for select
  to authenticated
  using (gym_id in (select private.current_user_gym_ids()));

create policy "Admins can manage gym settings"
  on public.gym_settings for all
  to authenticated
  using (private.is_gym_admin(gym_id))
  with check (private.is_gym_admin(gym_id));

-- =============================================================================
-- 4. INSTRUCTORS
-- =============================================================================

create policy "Members can view instructors of their gym"
  on public.instructors for select
  to authenticated
  using (gym_id in (select private.current_user_gym_ids()));

create policy "Admins can manage instructors"
  on public.instructors for all
  to authenticated
  using (private.is_gym_admin(gym_id))
  with check (private.is_gym_admin(gym_id));

-- =============================================================================
-- 5. TARIFFS
-- =============================================================================

create policy "Members can view tariffs of their gym"
  on public.tariffs for select
  to authenticated
  using (gym_id in (select private.current_user_gym_ids()));

create policy "Admins can manage tariffs"
  on public.tariffs for all
  to authenticated
  using (private.is_gym_admin(gym_id))
  with check (private.is_gym_admin(gym_id));

-- =============================================================================
-- 6. MEMBERS
-- =============================================================================

create policy "Gym users can view members"
  on public.members for select
  to authenticated
  using (gym_id in (select private.current_user_gym_ids()));

-- Staff/trainer/admin pueden crear socios
create policy "Gym staff can create members"
  on public.members for insert
  to authenticated
  with check (
    gym_id in (select private.current_user_gym_ids())
    and private.user_role_in_gym(gym_id) in ('super_admin', 'owner', 'admin', 'staff')
  );

create policy "Gym staff can update members"
  on public.members for update
  to authenticated
  using (
    gym_id in (select private.current_user_gym_ids())
    and private.user_role_in_gym(gym_id) in ('super_admin', 'owner', 'admin', 'staff')
  )
  with check (
    gym_id in (select private.current_user_gym_ids())
    and private.user_role_in_gym(gym_id) in ('super_admin', 'owner', 'admin', 'staff')
  );

-- DELETE restringido a admin/owner (RGPD: derecho al olvido)
create policy "Admins can delete members"
  on public.members for delete
  to authenticated
  using (private.is_gym_admin(gym_id));

-- =============================================================================
-- 7. MEMBER_TARIFFS
-- =============================================================================

create policy "Gym users can view member tariffs"
  on public.member_tariffs for select
  to authenticated
  using (gym_id in (select private.current_user_gym_ids()));

create policy "Gym staff can manage member tariffs"
  on public.member_tariffs for all
  to authenticated
  using (
    gym_id in (select private.current_user_gym_ids())
    and private.user_role_in_gym(gym_id) in ('super_admin', 'owner', 'admin', 'staff')
  )
  with check (
    gym_id in (select private.current_user_gym_ids())
    and private.user_role_in_gym(gym_id) in ('super_admin', 'owner', 'admin', 'staff')
  );

-- =============================================================================
-- 8. CLASSES
-- =============================================================================

create policy "Gym users can view classes"
  on public.classes for select
  to authenticated
  using (gym_id in (select private.current_user_gym_ids()));

create policy "Admins can manage classes"
  on public.classes for all
  to authenticated
  using (private.is_gym_admin(gym_id))
  with check (private.is_gym_admin(gym_id));

-- =============================================================================
-- 9. CLASS_INSTANCES
-- =============================================================================

create policy "Gym users can view class instances"
  on public.class_instances for select
  to authenticated
  using (gym_id in (select private.current_user_gym_ids()));

-- Staff+ puede modificar instancias (ej: cancelar una clase puntual)
create policy "Gym staff can manage class instances"
  on public.class_instances for all
  to authenticated
  using (
    gym_id in (select private.current_user_gym_ids())
    and private.user_role_in_gym(gym_id) in ('super_admin', 'owner', 'admin', 'staff', 'trainer')
  )
  with check (
    gym_id in (select private.current_user_gym_ids())
    and private.user_role_in_gym(gym_id) in ('super_admin', 'owner', 'admin', 'staff', 'trainer')
  );

-- =============================================================================
-- 10. BOOKINGS
-- =============================================================================

create policy "Gym users can view bookings"
  on public.bookings for select
  to authenticated
  using (gym_id in (select private.current_user_gym_ids()));

create policy "Gym staff can manage bookings"
  on public.bookings for all
  to authenticated
  using (
    gym_id in (select private.current_user_gym_ids())
    and private.user_role_in_gym(gym_id) in ('super_admin', 'owner', 'admin', 'staff', 'trainer')
  )
  with check (
    gym_id in (select private.current_user_gym_ids())
    and private.user_role_in_gym(gym_id) in ('super_admin', 'owner', 'admin', 'staff', 'trainer')
  );

-- =============================================================================
-- 11. PAYMENTS — crítico para integridad contable
-- =============================================================================

create policy "Gym users can view payments"
  on public.payments for select
  to authenticated
  using (gym_id in (select private.current_user_gym_ids()));

-- INSERT: staff+ puede registrar pagos
create policy "Gym staff can create payments"
  on public.payments for insert
  to authenticated
  with check (
    gym_id in (select private.current_user_gym_ids())
    and private.user_role_in_gym(gym_id) in ('super_admin', 'owner', 'admin', 'staff')
  );

-- UPDATE: solo owner/admin (protección contra manipulación contable por staff)
create policy "Admins can update payments"
  on public.payments for update
  to authenticated
  using (private.is_gym_admin(gym_id))
  with check (private.is_gym_admin(gym_id));

-- DELETE: prohibido desde app (nunca borrar pagos — soft delete vía status='cancelled')
-- No policy de DELETE = deny by default. Solo service_role puede borrar.

-- =============================================================================
-- 12. NOTIFICATIONS
-- =============================================================================

-- Ver solo mis notifs o las globales del gym (user_id null)
create policy "Users can view their notifications"
  on public.notifications for select
  to authenticated
  using (
    gym_id in (select private.current_user_gym_ids())
    and (user_id = (select auth.uid()) or user_id is null)
  );

-- Marcar como leída: solo mis notifs
create policy "Users can update their own notifications"
  on public.notifications for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- INSERT: solo admins pueden crear notifs para otros users
create policy "Admins can create notifications"
  on public.notifications for insert
  to authenticated
  with check (private.is_gym_admin(gym_id));

-- =============================================================================
-- 13. TASKS
-- =============================================================================

create policy "Gym users can view tasks"
  on public.tasks for select
  to authenticated
  using (gym_id in (select private.current_user_gym_ids()));

create policy "Gym staff can manage tasks"
  on public.tasks for all
  to authenticated
  using (
    gym_id in (select private.current_user_gym_ids())
    and private.user_role_in_gym(gym_id) in ('super_admin', 'owner', 'admin', 'staff', 'trainer')
  )
  with check (
    gym_id in (select private.current_user_gym_ids())
    and private.user_role_in_gym(gym_id) in ('super_admin', 'owner', 'admin', 'staff', 'trainer')
  );

-- =============================================================================
-- 14. CONVERSATIONS + MESSAGES
-- =============================================================================

create policy "Gym users can view conversations"
  on public.conversations for select
  to authenticated
  using (gym_id in (select private.current_user_gym_ids()));

create policy "Gym staff can manage conversations"
  on public.conversations for all
  to authenticated
  using (
    gym_id in (select private.current_user_gym_ids())
    and private.user_role_in_gym(gym_id) in ('super_admin', 'owner', 'admin', 'staff', 'trainer')
  )
  with check (
    gym_id in (select private.current_user_gym_ids())
    and private.user_role_in_gym(gym_id) in ('super_admin', 'owner', 'admin', 'staff', 'trainer')
  );

create policy "Gym users can view messages"
  on public.messages for select
  to authenticated
  using (gym_id in (select private.current_user_gym_ids()));

create policy "Gym staff can send messages"
  on public.messages for insert
  to authenticated
  with check (
    gym_id in (select private.current_user_gym_ids())
    and private.user_role_in_gym(gym_id) in ('super_admin', 'owner', 'admin', 'staff', 'trainer')
  );

-- =============================================================================
-- 15. OFFERS
-- =============================================================================

create policy "Gym users can view offers"
  on public.offers for select
  to authenticated
  using (gym_id in (select private.current_user_gym_ids()));

create policy "Admins can manage offers"
  on public.offers for all
  to authenticated
  using (private.is_gym_admin(gym_id))
  with check (private.is_gym_admin(gym_id));

-- =============================================================================
-- 16. WORKOUTS
-- =============================================================================

create policy "Gym users can view workouts"
  on public.workouts for select
  to authenticated
  using (gym_id in (select private.current_user_gym_ids()));

create policy "Trainers+ can manage workouts"
  on public.workouts for all
  to authenticated
  using (
    gym_id in (select private.current_user_gym_ids())
    and private.user_role_in_gym(gym_id) in ('super_admin', 'owner', 'admin', 'staff', 'trainer')
  )
  with check (
    gym_id in (select private.current_user_gym_ids())
    and private.user_role_in_gym(gym_id) in ('super_admin', 'owner', 'admin', 'staff', 'trainer')
  );

-- =============================================================================
-- 17. COMPETITIONS
-- =============================================================================

create policy "Gym users can view competitions"
  on public.competitions for select
  to authenticated
  using (gym_id in (select private.current_user_gym_ids()));

create policy "Admins can manage competitions"
  on public.competitions for all
  to authenticated
  using (private.is_gym_admin(gym_id))
  with check (private.is_gym_admin(gym_id));

-- =============================================================================
-- 18. SHOP_PRODUCTS + SHOP_ORDERS
-- =============================================================================

create policy "Gym users can view shop products"
  on public.shop_products for select
  to authenticated
  using (gym_id in (select private.current_user_gym_ids()));

create policy "Admins can manage shop products"
  on public.shop_products for all
  to authenticated
  using (private.is_gym_admin(gym_id))
  with check (private.is_gym_admin(gym_id));

create policy "Gym users can view shop orders"
  on public.shop_orders for select
  to authenticated
  using (gym_id in (select private.current_user_gym_ids()));

create policy "Gym staff can manage shop orders"
  on public.shop_orders for all
  to authenticated
  using (
    gym_id in (select private.current_user_gym_ids())
    and private.user_role_in_gym(gym_id) in ('super_admin', 'owner', 'admin', 'staff')
  )
  with check (
    gym_id in (select private.current_user_gym_ids())
    and private.user_role_in_gym(gym_id) in ('super_admin', 'owner', 'admin', 'staff')
  );

-- =============================================================================
-- 19. POSTS
-- =============================================================================

create policy "Gym users can view posts"
  on public.posts for select
  to authenticated
  using (gym_id in (select private.current_user_gym_ids()));

create policy "Gym staff can manage posts"
  on public.posts for all
  to authenticated
  using (
    gym_id in (select private.current_user_gym_ids())
    and private.user_role_in_gym(gym_id) in ('super_admin', 'owner', 'admin', 'staff', 'trainer')
  )
  with check (
    gym_id in (select private.current_user_gym_ids())
    and private.user_role_in_gym(gym_id) in ('super_admin', 'owner', 'admin', 'staff', 'trainer')
  );

-- =============================================================================
-- 20. REPORTS_SNAPSHOTS
-- =============================================================================

create policy "Gym users can view reports"
  on public.reports_snapshots for select
  to authenticated
  using (gym_id in (select private.current_user_gym_ids()));

-- Solo backend (service_role) escribe snapshots. Sin policies INSERT/UPDATE/DELETE.

-- =============================================================================
-- 21. AUDIT_LOG
-- =============================================================================

-- Solo admins pueden leer el audit log
create policy "Admins can view audit log"
  on public.audit_log for select
  to authenticated
  using (
    gym_id is not null
    and private.is_gym_admin(gym_id)
  );

-- Solo backend (service_role) escribe logs. Sin policies INSERT.

-- =============================================================================
-- FIN POLICIES
-- =============================================================================
