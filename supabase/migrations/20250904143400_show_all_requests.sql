create policy "User can view all time off requests"
on "public"."time_off_requests"
as permissive
for select
to authenticated
using (true);



