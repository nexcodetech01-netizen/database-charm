-- Inserir/Atualizar o e-mail específico como admin automaticamente
DO $$
DECLARE
    v_user_id uuid;
BEGIN
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'eosantana014@gmail.com';
    IF v_user_id IS NOT NULL THEN
        -- Garantir que a role admin existe se for um enum
        -- Se user_roles.role for public.app_role enum ('admin', 'moderator', 'user')
        INSERT INTO public.user_roles (user_id, role)
        VALUES (v_user_id, 'admin')
        ON CONFLICT (user_id, role) DO NOTHING;
    END IF;
END $$;
