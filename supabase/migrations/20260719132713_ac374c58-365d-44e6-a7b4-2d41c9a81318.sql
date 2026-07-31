CREATE OR REPLACE FUNCTION public.get_company_invite_by_token(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invite record;
BEGIN
  IF _token IS NULL OR length(_token) < 10 OR length(_token) > 200 THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_found');
  END IF;

  SELECT ci.id,
         ci.email,
         ci.name,
         ci.status,
         ci.expires_at,
         c.name AS company_name,
         r.name AS role_name
    INTO v_invite
    FROM public.company_invites ci
    JOIN public.companies c ON c.id = ci.company_id
    JOIN public.roles r ON r.id = ci.role_id
   WHERE ci.token = _token
   LIMIT 1;

  IF v_invite.id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_found');
  END IF;

  IF v_invite.status <> 'pending' THEN
    RETURN jsonb_build_object('valid', false, 'reason', v_invite.status);
  END IF;

  IF v_invite.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'expired');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'email', v_invite.email,
    'name', v_invite.name,
    'companyName', v_invite.company_name,
    'roleName', v_invite.role_name
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_company_invite_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_company_invite_by_token(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.accept_company_invite(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_invite public.company_invites%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária.' USING ERRCODE = '42501';
  END IF;

  SELECT *
    INTO v_invite
    FROM public.company_invites
   WHERE token = _token
   FOR UPDATE;

  IF v_invite.id IS NULL THEN
    RAISE EXCEPTION 'Convite não encontrado.';
  END IF;

  IF v_invite.status <> 'pending' THEN
    RAISE EXCEPTION 'Convite não está mais disponível.';
  END IF;

  IF v_invite.expires_at < now() THEN
    UPDATE public.company_invites
       SET status = 'expired', updated_at = now()
     WHERE id = v_invite.id;
    RAISE EXCEPTION 'Convite expirado.';
  END IF;

  IF lower(v_invite.email) <> v_user_email THEN
    RAISE EXCEPTION 'Este convite é para %. Entre com essa conta para aceitar.', v_invite.email;
  END IF;

  INSERT INTO public.profiles (id, current_company_id)
  VALUES (v_user_id, v_invite.company_id)
  ON CONFLICT (id) DO UPDATE
    SET current_company_id = EXCLUDED.current_company_id,
        updated_at = now();

  INSERT INTO public.user_roles (user_id, company_id, role_id)
  VALUES (v_user_id, v_invite.company_id, v_invite.role_id)
  ON CONFLICT (user_id, company_id, role_id) DO NOTHING;

  UPDATE public.company_invites
     SET status = 'accepted',
         accepted_at = now(),
         accepted_by = v_user_id,
         updated_at = now()
   WHERE id = v_invite.id;

  RETURN jsonb_build_object('ok', true, 'companyId', v_invite.company_id);
END;
$$;

REVOKE ALL ON FUNCTION public.accept_company_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_company_invite(text) TO authenticated, service_role;