set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.delete_time_off_request(request_id uuid)
 RETURNS void
 LANGUAGE sql
AS $function$
  DELETE FROM time_off_requests
  WHERE id = request_id;
$function$
;


create policy "Allow delete on own requests"
  on time_off_requests
  for delete
  using (auth.uid() = user_id);
