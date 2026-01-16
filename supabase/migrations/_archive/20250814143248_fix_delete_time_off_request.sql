set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.delete_time_off_request(request_id uuid)
 RETURNS void
 LANGUAGE sql
AS $function$
  DELETE FROM public.time_off_requests
  WHERE id = request_id
$function$
;


create policy "Users can delete their own time off requests"
on "public"."time_off_requests"
as permissive
for delete
to authenticated
using ((( SELECT auth.uid() AS uid) = user_id));



