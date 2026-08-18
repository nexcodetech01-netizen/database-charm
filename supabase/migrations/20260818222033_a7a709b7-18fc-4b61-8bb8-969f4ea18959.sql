GRANT EXECUTE ON FUNCTION public.user_has_company_access(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.user_has_company_access(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';

SELECT 
    grantee, 
    privilege_type 
FROM information_schema.routine_privileges 
WHERE routine_name = 'user_has_company_access' 
  AND routine_schema = 'public';