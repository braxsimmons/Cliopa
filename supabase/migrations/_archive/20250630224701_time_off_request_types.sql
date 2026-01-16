drop policy "kpis_delete_policy" on "public"."kpis";
drop policy "kpis_insert_policy" on "public"."kpis";
drop policy "kpis_select_policy" on "public"."kpis";
drop policy "kpis_update_policy" on "public"."kpis";
drop policy "profiles_delete_policy" on "public"."profiles";
drop policy "profiles_insert_policy" on "public"."profiles";
drop policy "profiles_select_policy" on "public"."profiles";
drop policy "profiles_update_policy" on "public"."profiles";
drop policy "time_entries_delete_policy" on "public"."time_entries";
drop policy "time_entries_insert_policy" on "public"."time_entries";
drop policy "time_entries_select_policy" on "public"."time_entries";
drop policy "time_entries_update_policy" on "public"."time_entries";
drop policy "user_roles_delete_policy" on "public"."user_roles";
drop policy "user_roles_insert_policy" on "public"."user_roles";
drop policy "user_roles_select_policy" on "public"."user_roles";
drop policy "user_roles_update_policy" on "public"."user_roles";
drop policy "Admins and managers can view all approved time off" on "public"."approved_time_off";
drop policy "Only admins and managers can insert approved time off" on "public"."approved_time_off";
drop policy "Users can view their own approved time off" on "public"."approved_time_off";
drop policy "Users can create their own early clock attempts" on "public"."early_clock_attempts";
drop policy "Users can update their own early clock attempts" on "public"."early_clock_attempts";
drop policy "Users can view their own early clock attempts" on "public"."early_clock_attempts";
drop policy "Admins can manage holidays" on "public"."holidays";
drop policy "Admins can manage all KPIs" on "public"."kpis";
drop policy "Admins can manage pay periods" on "public"."pay_periods";
drop policy "Users can view their own KPIs" on "public"."kpis";
drop policy "Admins can manage payroll calculations" on "public"."payroll_calculations";
drop policy "Admins and managers can update time corrections" on "public"."time_corrections";
drop policy "Admins and managers can view all time corrections" on "public"."time_corrections";
drop policy "Users can create their own time corrections" on "public"."time_corrections";
drop policy "Users can view their own time corrections" on "public"."time_corrections";
drop policy "Admins can view all time entries" on "public"."time_entries";
drop policy "Users can create their own time entries" on "public"."time_entries";
drop policy "Users can delete their own time entries" on "public"."time_entries";
drop policy "Admins can update all time off requests" on "public"."time_off_requests";
drop policy "Admins can view all time off requests" on "public"."time_off_requests";
drop policy "Users can create their own time off requests" on "public"."time_off_requests";
drop policy "Users can update their own pending requests" on "public"."time_off_requests";
drop policy "Users can view their own time off requests" on "public"."time_off_requests";
drop policy "Admins can insert time off taken records" on "public"."time_off_taken";
drop policy "Admins can update time off taken records" on "public"."time_off_taken";
drop policy "Admins can view all time off taken records" on "public"."time_off_taken";
drop policy "Users can view their own time off taken" on "public"."time_off_taken";

alter table "public"."approved_time_off" disable row level security;
alter table "public"."early_clock_attempts" disable row level security;
alter table "public"."employee_shifts" disable row level security;
alter table "public"."holidays" disable row level security;
alter table "public"."kpis" disable row level security;
alter table "public"."pay_periods" disable row level security;
alter table "public"."payroll_calculations" disable row level security;
alter table "public"."profiles" disable row level security;
alter table "public"."time_corrections" disable row level security;
alter table "public"."time_entries" disable row level security;
alter table "public"."time_off_requests" disable row level security;
alter table "public"."time_off_taken" disable row level security;
alter table "public"."user_roles" disable row level security;

set check_function_bodies = off;

create policy "Admins and managers may add any kpis"
on "public"."kpis"
as permissive
for insert
to authenticated
with check (( SELECT public.has_any_role(ARRAY['admin'::public.app_role, 'manager'::public.app_role])));


create policy "Admins and managers may delete any kpis"
on "public"."kpis"
as permissive
for delete
to authenticated
using (( SELECT public.has_any_role(ARRAY['admin'::public.app_role, 'manager'::public.app_role])));


create policy "Admins and managers may update any kpis"
on "public"."kpis"
as permissive
for update
to authenticated
using (( SELECT public.has_any_role(ARRAY['admin'::public.app_role, 'manager'::public.app_role])));


create policy "Admins and managers may view all kpis"
on "public"."kpis"
as permissive
for select
to authenticated
using (( SELECT public.has_any_role(ARRAY['admin'::public.app_role, 'manager'::public.app_role])));


create policy "Admins may delete any profile"
on "public"."profiles"
as permissive
for delete
to authenticated
using (( SELECT public.has_role('admin'::public.app_role)));


create policy "Admins or the owner may create a profile"
on "public"."profiles"
as permissive
for insert
to authenticated
with check (((SELECT auth.uid()) = profiles.id OR public.has_role('admin'::public.app_role)));


create policy "Admins or the owner may update a profile"
on "public"."profiles"
as permissive
for update
to authenticated
using (((SELECT auth.uid()) = profiles.id OR public.has_role('admin'::public.app_role)));


create policy "Admins or the owner may view a profile"
on "public"."profiles"
as permissive
for select
to authenticated
using (((SELECT auth.uid()) = profiles.id OR public.has_role('admin'::public.app_role)));


create policy "Admins, managers, and the owner may create new entries"
on "public"."time_entries"
as permissive
for insert
to authenticated
with check (((SELECT auth.uid()) = time_entries.user_id OR public.has_any_role(ARRAY['admin'::public.app_role, 'manager'::public.app_role])));


create policy "Admins, managers, and the owner may delete time entries"
on "public"."time_entries"
as permissive
for delete
to authenticated
using (((SELECT auth.uid()) = time_entries.user_id OR public.has_any_role(ARRAY['admin'::public.app_role, 'manager'::public.app_role])));


create policy "Admins, managers, and the owner may see entries"
on "public"."time_entries"
as permissive
for select
to authenticated
using (((SELECT auth.uid()) = time_entries.user_id OR public.has_any_role(ARRAY['admin'::public.app_role, 'manager'::public.app_role])));


create policy "Admins, managers, and the owner may update entries"
on "public"."time_entries"
as permissive
for update
to authenticated
using (((SELECT auth.uid()) = time_entries.user_id OR public.has_any_role(ARRAY['admin'::public.app_role, 'manager'::public.app_role])));


create policy "Admins may create user roles"
on "public"."user_roles"
as permissive
for insert
to authenticated
with check (( SELECT public.has_role('admin'::public.app_role)));


create policy "Admins may delete user roles"
on "public"."user_roles"
as permissive
for delete
to authenticated
using (( SELECT public.has_role('admin'::public.app_role)));


create policy "Admins may update user roles"
on "public"."user_roles"
as permissive
for update
to authenticated
using (( SELECT public.has_role('admin'::public.app_role)));


create policy "Admins or the owner may read user roles"
on "public"."user_roles"
as permissive
for select
to authenticated
using ((SELECT public.has_any_role(ARRAY['admin'::public.app_role, 'manager'::public.app_role])));


create policy "Admins and managers can view all approved time off"
on "public"."approved_time_off"
as permissive
for select
to authenticated
using ((SELECT public.has_any_role(ARRAY['admin'::public.app_role, 'manager'::public.app_role])));


create policy "Only admins and managers can insert approved time off"
on "public"."approved_time_off"
as permissive
for insert
to authenticated
with check ((SELECT public.has_any_role(ARRAY['admin'::public.app_role, 'manager'::public.app_role])));


create policy "Users can view their own approved time off"
on "public"."approved_time_off"
as permissive
for select
to authenticated
using ((( SELECT auth.uid()) = approved_time_off.user_id));


create policy "Users can create their own early clock attempts"
on "public"."early_clock_attempts"
as permissive
for insert
to authenticated
with check ((( SELECT auth.uid()) = early_clock_attempts.user_id));


create policy "Users can update their own early clock attempts"
on "public"."early_clock_attempts"
as permissive
for update
to authenticated
using ((( SELECT auth.uid()) = early_clock_attempts.user_id));


create policy "Users can view their own early clock attempts"
on "public"."early_clock_attempts"
as permissive
for select
to authenticated
using ((( SELECT auth.uid()) = early_clock_attempts.user_id));


create policy "Admins can manage holidays"
on "public"."holidays"
as permissive
for all
to authenticated
using ((SELECT public.has_any_role(ARRAY['admin'::public.app_role])));


create policy "Users can view their own KPIs"
on "public"."kpis"
as permissive
for select
to authenticated
using ((( SELECT auth.uid()) = kpis.user_id));

create policy "Users can create their own KPIs"
on "public"."kpis"
as permissive
for insert
to authenticated
with check ((( SELECT auth.uid()) = kpis.user_id));

create policy "Users can update their own KPIs"
on "public"."kpis"
as permissive
for update
to authenticated
using ((( SELECT auth.uid()) = kpis.user_id));


create policy "Admins can manage pay periods"
on "public"."pay_periods"
as permissive
for all
to authenticated
using ((SELECT public.has_any_role(ARRAY['admin'::public.app_role])));


create policy "Admins can manage payroll calculations"
on "public"."payroll_calculations"
as permissive
for all
to authenticated
using ((SELECT public.has_any_role(ARRAY['admin'::public.app_role])));


create policy "Admins and managers can update time corrections"
on "public"."time_corrections"
as permissive
for update
to authenticated
using ((SELECT public.has_any_role(ARRAY['admin'::public.app_role, 'manager'::public.app_role])));


create policy "Admins and managers can view all time corrections"
on "public"."time_corrections"
as permissive
for select
to authenticated
using ((SELECT public.has_any_role(ARRAY['admin'::public.app_role, 'manager'::public.app_role])));


create policy "Users can create their own time corrections"
on "public"."time_corrections"
as permissive
for insert
to authenticated
with check ((( SELECT auth.uid()) = time_corrections.user_id));


create policy "Users can view their own time corrections"
on "public"."time_corrections"
as permissive
for select
to authenticated
using ((( SELECT auth.uid()) = time_corrections.user_id));


create policy "Admins can view all time entries"
on "public"."time_entries"
as permissive
for select
to authenticated
using ((SELECT public.has_any_role(ARRAY['admin'::public.app_role])));


create policy "Users can create their own time entries"
on "public"."time_entries"
as permissive
for insert
to authenticated
with check ((( SELECT auth.uid()) = time_entries.user_id));


create policy "Users can delete their own time entries"
on "public"."time_entries"
as permissive
for delete
to authenticated
using ((( SELECT auth.uid()) = time_entries.user_id));


create policy "Admins can update all time off requests"
on "public"."time_off_requests"
as permissive
for update
to authenticated
using ((SELECT public.has_any_role(ARRAY['admin'::public.app_role])));


create policy "Admins can view all time off requests"
on "public"."time_off_requests"
as permissive
for select
to authenticated
using ((SELECT public.has_any_role(ARRAY['admin'::public.app_role])));


create policy "Users can create their own time off requests"
on "public"."time_off_requests"
as permissive
for insert
to authenticated
with check (( SELECT (auth.uid() = time_off_requests.user_id)));


create policy "Users can update their own pending requests"
on "public"."time_off_requests"
as permissive
for update
to public
using (( SELECT ((auth.uid() = time_off_requests.user_id) AND (time_off_requests.status = 'pending'::text))));


create policy "Users can view their own time off requests"
on "public"."time_off_requests"
as permissive
for select
to authenticated
using ((( SELECT auth.uid()) = time_off_requests.user_id));


create policy "Admins can insert time off taken records"
on "public"."time_off_taken"
as permissive
for insert
to authenticated
with check ((SELECT public.has_any_role(ARRAY['admin'::public.app_role])));


create policy "Admins can update time off taken records"
on "public"."time_off_taken"
as permissive
for update
to authenticated
using ((SELECT public.has_any_role(ARRAY['admin'::public.app_role])));


create policy "Admins can view all time off taken records"
on "public"."time_off_taken"
as permissive
for select
to authenticated
using ((SELECT public.has_any_role(ARRAY['admin'::public.app_role])));


create policy "Users can view their own time off taken"
on "public"."time_off_taken"
as permissive
for select
to authenticated
using ((( SELECT auth.uid()) = time_off_taken.user_id));

alter table "public"."approved_time_off" enable row level security;
alter table "public"."early_clock_attempts" enable row level security;
alter table "public"."employee_shifts" enable row level security;
alter table "public"."holidays" enable row level security;
alter table "public"."kpis" enable row level security;
alter table "public"."pay_periods" enable row level security;
alter table "public"."payroll_calculations" enable row level security;
alter table "public"."profiles" enable row level security;
alter table "public"."time_corrections" enable row level security;
alter table "public"."time_entries" enable row level security;
alter table "public"."time_off_requests" enable row level security;
alter table "public"."time_off_taken" enable row level security;
alter table "public"."user_roles" enable row level security;
