drop policy "Admins and managers can view all approved time off" on "public"."approved_time_off";

drop policy "Admins and managers can view all time corrections" on "public"."time_corrections";

drop policy "Users can view their own time corrections" on "public"."time_corrections";

drop policy "Admins can update all time off requests" on "public"."time_off_requests";

drop policy "Admins can view all time off requests" on "public"."time_off_requests";

drop policy "Users can update their own pending requests" on "public"."time_off_requests";

drop policy "Users can view their own time off requests" on "public"."time_off_requests";

drop policy "Admins can insert time off taken records" on "public"."time_off_taken";

drop policy "Admins can view all time off taken records" on "public"."time_off_taken";

drop policy "Users can view their own time off taken" on "public"."time_off_taken";

alter table "public"."time_corrections" disable row level security;

create policy "Admins and managers or the owner can view approved time off"
on "public"."approved_time_off"
as permissive
for select
to authenticated
using (((( SELECT auth.uid() AS uid) = user_id) OR ( SELECT has_any_role(ARRAY['admin'::app_role, 'manager'::app_role]) AS has_any_role)));


create policy "Admins and managers or the owner can view time corrections"
on "public"."time_corrections"
as permissive
for select
to authenticated
using ((( SELECT has_any_role(ARRAY['admin'::app_role, 'manager'::app_role]) AS has_any_role) OR (( SELECT auth.uid() AS uid) = user_id)));


create policy "Admins and user can update time off requests"
on "public"."time_off_requests"
as permissive
for update
to authenticated
using ((( SELECT has_any_role(ARRAY['admin'::app_role]) AS has_any_role) OR ((( SELECT auth.uid() AS uid) = user_id) AND (status = 'pending'::text))));


create policy "Admins or the owner can view time off requests"
on "public"."time_off_requests"
as permissive
for select
to authenticated
using ((( SELECT has_any_role(ARRAY['admin'::app_role]) AS has_any_role) OR (( SELECT auth.uid() AS uid) = user_id)));


create policy "Admins can insert time of taken records"
on "public"."time_off_taken"
as permissive
for insert
to authenticated
with check (( SELECT has_any_role(ARRAY['admin'::app_role]) AS has_any_role));


create policy "Admins or the owner can view time off taken records"
on "public"."time_off_taken"
as permissive
for select
to authenticated
using ((( SELECT has_any_role(ARRAY['admin'::app_role]) AS has_any_role) OR (( SELECT auth.uid() AS uid) = user_id)));



