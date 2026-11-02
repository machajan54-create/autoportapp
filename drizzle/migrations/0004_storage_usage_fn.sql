CREATE OR REPLACE FUNCTION public.get_storage_usage()
RETURNS TABLE(db_bytes bigint, files_bytes bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT pg_database_size(current_database())::bigint,
         COALESCE((SELECT sum((metadata->>'size')::bigint) FROM storage.objects), 0)::bigint
$$;
REVOKE ALL ON FUNCTION public.get_storage_usage() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_storage_usage() TO service_role;