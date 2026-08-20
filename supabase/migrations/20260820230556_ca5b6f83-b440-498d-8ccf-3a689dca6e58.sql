
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' AND policyname = 'Users can update their own notification settings'
    ) THEN
        CREATE POLICY "Users can update their own notification settings" 
        ON public.profiles 
        FOR UPDATE 
        TO authenticated 
        USING (auth.uid() = id) 
        WITH CHECK (auth.uid() = id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' AND policyname = 'Users can read their own notification settings'
    ) THEN
        CREATE POLICY "Users can read their own notification settings" 
        ON public.profiles 
        FOR SELECT 
        TO authenticated 
        USING (auth.uid() = id);
    END IF;
END $$;
