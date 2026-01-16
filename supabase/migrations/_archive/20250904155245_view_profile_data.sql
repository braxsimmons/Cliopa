drop policy "Admins or the owner may view a profile" on "public"."profiles";

create policy "Users with role may view a profile"
on "public"."profiles"
as permissive
for select
to authenticated
using (((( SELECT auth.uid() AS uid) = id) OR ( SELECT has_any_role(ARRAY['admin'::app_role, 'manager'::app_role, 'ccm'::app_role, 'crm'::app_role]) AS has_any_role)));



