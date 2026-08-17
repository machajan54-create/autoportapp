REVOKE EXECUTE ON FUNCTION public.is_task_participant(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_task_participant(uuid, uuid) TO authenticated, service_role;