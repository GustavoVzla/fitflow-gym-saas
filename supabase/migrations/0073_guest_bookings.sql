-- 0073_guest_bookings.sql
-- F2.2 Apuntar invitado (no-socio) a una clase del horario
-- Permite al staff registrar asistencia one-shot sin crear cuenta completa de socio.
--
-- Approach: usar tabla `members` con flag `is_guest=true` (no nueva tabla).
-- Justificación: bookings.member_id ya es FK a members, evita refactor queries.
-- Los guest members quedan en `status='guest'` con email nullable.

-- 1) Flag is_guest + estado 'guest' compatible con member_status enum actual
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'members' AND column_name = 'is_guest'
  ) THEN
    ALTER TABLE public.members ADD COLUMN is_guest boolean NOT NULL DEFAULT false;
    CREATE INDEX IF NOT EXISTS idx_members_gym_guest ON public.members (gym_id, is_guest) WHERE is_guest = true;
  END IF;
END
$$;

COMMENT ON COLUMN public.members.is_guest IS
  'F2.2: true si el member fue creado como invitado one-shot (staff apuntó a clase sin crear cuenta). No paga mensualidad, no tiene auth_user_id.';

-- 2) RPC atómico: crea member guest + booking en una sola transacción
-- Valida capacity igual que book_class. Solo owner/admin del gym puede ejecutar.
CREATE OR REPLACE FUNCTION public.create_guest_booking(
  p_class_instance_id uuid,
  p_first_name text,
  p_last_name text,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_payment_method text DEFAULT NULL,
  p_amount numeric DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_gym_id uuid;
  v_max_spots integer;
  v_confirmed_count integer;
  v_class_status text;
  v_caller uuid := auth.uid();
  v_caller_role text;
  v_member_id uuid;
  v_booking_id uuid;
BEGIN
  -- Obtener clase + gym_id
  SELECT gym_id, max_spots, status
    INTO v_gym_id, v_max_spots, v_class_status
    FROM public.class_instances
    WHERE id = p_class_instance_id;

  IF v_gym_id IS NULL THEN
    RAISE EXCEPTION 'not found: class_instance %', p_class_instance_id USING ERRCODE = 'P0002';
  END IF;

  IF v_class_status <> 'scheduled' THEN
    RAISE EXCEPTION 'class is not available: status=%', v_class_status USING ERRCODE = 'P0001';
  END IF;

  -- Autz: caller debe ser owner o admin del gym
  SELECT role::text INTO v_caller_role
    FROM public.gym_users
    WHERE user_id = v_caller AND gym_id = v_gym_id
    LIMIT 1;

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'forbidden: only owner/admin can add guest bookings' USING ERRCODE = '42501';
  END IF;

  -- Validar inputs
  IF coalesce(length(trim(p_first_name)), 0) = 0 THEN
    RAISE EXCEPTION 'first_name is required' USING ERRCODE = 'P0001';
  END IF;
  IF coalesce(length(trim(p_last_name)), 0) = 0 THEN
    RAISE EXCEPTION 'last_name is required' USING ERRCODE = 'P0001';
  END IF;

  -- Capacity check (solo confirmed counts vs max_spots)
  SELECT count(*) INTO v_confirmed_count
    FROM public.bookings
    WHERE class_instance_id = p_class_instance_id
      AND status = 'confirmed';

  IF v_confirmed_count >= v_max_spots THEN
    RAISE EXCEPTION 'class is full' USING ERRCODE = 'P0001';
  END IF;

  -- Crear member guest (no RGPD consent — staff registra acción on-behalf)
  INSERT INTO public.members (
    gym_id,
    first_name,
    last_name,
    email,
    phone,
    status,
    is_guest
  )
  VALUES (
    v_gym_id,
    trim(p_first_name),
    trim(p_last_name),
    nullif(trim(p_email), ''),
    nullif(trim(p_phone), ''),
    'active',
    true
  )
  RETURNING id INTO v_member_id;

  -- Crear booking directamente como 'confirmed' (staff lo añade manualmente)
  INSERT INTO public.bookings (
    gym_id,
    class_instance_id,
    member_id,
    status
  )
  VALUES (
    v_gym_id,
    p_class_instance_id,
    v_member_id,
    'confirmed'
  )
  RETURNING id INTO v_booking_id;

  -- Si pago inmediato, crear payment row (opcional)
  IF p_payment_method IS NOT NULL AND p_amount IS NOT NULL AND p_amount > 0 THEN
    INSERT INTO public.payments (
      gym_id,
      member_id,
      amount,
      currency,
      description,
      method,
      status,
      paid_at
    )
    VALUES (
      v_gym_id,
      v_member_id,
      p_amount,
      'EUR',
      'Pago invitado - clase ' || coalesce(to_char(now() AT TIME ZONE 'Europe/Madrid', 'DD/MM/YYYY HH24:MI'), ''),
      p_payment_method,
      'completed',
      now()
    );
  END IF;

  RETURN v_booking_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_guest_booking(uuid, text, text, text, text, text, numeric) FROM public;
GRANT EXECUTE ON FUNCTION public.create_guest_booking(uuid, text, text, text, text, text, numeric) TO authenticated;

COMMENT ON FUNCTION public.create_guest_booking(uuid, text, text, text, text, text, numeric) IS
  'F2.2 Invitado no-socio: staff (owner/admin) crea member is_guest=true + booking confirmed atómico. Opcional payment row si p_payment_method + p_amount. Raises P0001/42501/P0002 según caso.';
