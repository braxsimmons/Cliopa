CREATE OR REPLACE FUNCTION public.delete_time_off_request(request_id uuid)
RETURNS void
language sql
as $$
  DELETE FROM public.time_off_requests
  WHERE id = request_id
$$;
