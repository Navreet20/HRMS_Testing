-- Drops every non-business table from hrms_new_schema (compat_*, auth_*, user_access, UPPERCASE legacy onboarding /
-- invoice tables). Safe to re-run. The 37 snake_case business tables are never touched.
--   psql -h localhost -U postgres -d hrms_new_schema -f db/drop_junk_tables.sql
DO $$
DECLARE r record;
BEGIN
    FOR r IN
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
          AND (tablename LIKE 'compat\_%'
               OR tablename IN ('auth_sessions', 'auth_credentials', 'auth_identities', 'user_access')
               OR tablename <> lower(tablename))
    LOOP
        EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', r.tablename);
        RAISE NOTICE 'dropped %', r.tablename;
    END LOOP;
END $$;
