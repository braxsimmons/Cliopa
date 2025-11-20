set search_path = public;

drop policy "Admins and managers may add any kpis" on "public"."kpis";

drop policy "Admins and managers may delete any kpis" on "public"."kpis";

drop policy "Admins and managers may update any kpis" on "public"."kpis";

drop policy "Admins and managers may view all kpis" on "public"."kpis";

drop policy "Users can create their own KPIs" on "public"."kpis";

drop policy "Users can update their own KPIs" on "public"."kpis";

drop policy "Users can view their own KPIs" on "public"."kpis";

drop policy "Admins can view all time entries" on "public"."time_entries";

drop policy "Users can create their own time entries" on "public"."time_entries";

drop policy "Users can delete their own time entries" on "public"."time_entries";

drop policy "Admins can delete employee shifts" on "public"."employee_shifts";

drop policy "Admins can insert employee shifts" on "public"."employee_shifts";

drop policy "Admins can update employee shifts" on "public"."employee_shifts";

drop policy "Admins or the owner may create a profile" on "public"."profiles";

drop policy "Admins or the owner may update a profile" on "public"."profiles";

drop policy "Admins or the owner may view a profile" on "public"."profiles";

drop policy "Admins, managers, and the owner may create new entries" on "public"."time_entries";

drop policy "Admins, managers, and the owner may delete time entries" on "public"."time_entries";

drop policy "Admins, managers, and the owner may see entries" on "public"."time_entries";

drop policy "Admins, managers, and the owner may update entries" on "public"."time_entries";

drop policy "Users can create their own time off requests" on "public"."time_off_requests";

drop policy "Users can update their own pending requests" on "public"."time_off_requests";

drop policy "Admins or the owner may read user roles" on "public"."user_roles";

create policy "Admins can delete employee shifts"
on "public"."employee_shifts"
as permissive
for delete
to authenticated
using (( SELECT has_any_role(ARRAY['admin'::app_role]) AS has_any_role));


create policy "Admins can insert employee shifts"
on "public"."employee_shifts"
as permissive
for insert
to authenticated
with check (( SELECT has_any_role(ARRAY['admin'::app_role]) AS has_any_role));


create policy "Admins can update employee shifts"
on "public"."employee_shifts"
as permissive
for update
to authenticated
using (( SELECT has_any_role(ARRAY['admin'::app_role]) AS has_any_role));


create policy "Admins or the owner may create a profile"
on "public"."profiles"
as permissive
for insert
to authenticated
with check (((( SELECT auth.uid() AS uid) = id) OR ( SELECT has_role('admin'::app_role) AS has_role)));


create policy "Admins or the owner may update a profile"
on "public"."profiles"
as permissive
for update
to authenticated
using (((( SELECT auth.uid() AS uid) = id) OR ( SELECT has_role('admin'::app_role) AS has_role)));


create policy "Admins or the owner may view a profile"
on "public"."profiles"
as permissive
for select
to authenticated
using (((( SELECT auth.uid() AS uid) = id) OR ( SELECT has_role('admin'::app_role) AS has_role)));


create policy "Admins, managers, and the owner may create new entries"
on "public"."time_entries"
as permissive
for insert
to authenticated
with check (((( SELECT auth.uid() AS uid) = user_id) OR ( SELECT has_any_role(ARRAY['admin'::app_role, 'manager'::app_role]) AS has_any_role)));


create policy "Admins, managers, and the owner may delete time entries"
on "public"."time_entries"
as permissive
for delete
to authenticated
using (((( SELECT auth.uid() AS uid) = user_id) OR ( SELECT has_any_role(ARRAY['admin'::app_role, 'manager'::app_role]) AS has_any_role)));


create policy "Admins, managers, and the owner may see entries"
on "public"."time_entries"
as permissive
for select
to authenticated
using (((( SELECT auth.uid() AS uid) = user_id) OR ( SELECT has_any_role(ARRAY['admin'::app_role, 'manager'::app_role]) AS has_any_role)));


create policy "Admins, managers, and the owner may update entries"
on "public"."time_entries"
as permissive
for update
to authenticated
using (((( SELECT auth.uid() AS uid) = user_id) OR ( SELECT has_any_role(ARRAY['admin'::app_role, 'manager'::app_role]) AS has_any_role)));


create policy "Users can create their own time off requests"
on "public"."time_off_requests"
as permissive
for insert
to authenticated
with check ((( SELECT auth.uid() AS uid) = user_id));


create policy "Users can update their own pending requests"
on "public"."time_off_requests"
as permissive
for update
to authenticated
using (((( SELECT auth.uid() AS uid) = user_id) AND (status = 'pending'::text)));


create policy "Admins or the owner may read user roles"
on "public"."user_roles"
as permissive
for select
to authenticated
using (((( SELECT auth.uid() AS uid) = user_id) OR ( SELECT has_role('admin'::app_role) AS has_role)));



