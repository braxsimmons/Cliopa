revoke delete on table "public"."profiles_timeoff_rules" from "anon";

revoke insert on table "public"."profiles_timeoff_rules" from "anon";

revoke references on table "public"."profiles_timeoff_rules" from "anon";

revoke select on table "public"."profiles_timeoff_rules" from "anon";

revoke trigger on table "public"."profiles_timeoff_rules" from "anon";

revoke truncate on table "public"."profiles_timeoff_rules" from "anon";

revoke update on table "public"."profiles_timeoff_rules" from "anon";

revoke delete on table "public"."profiles_timeoff_rules" from "authenticated";

revoke insert on table "public"."profiles_timeoff_rules" from "authenticated";

revoke references on table "public"."profiles_timeoff_rules" from "authenticated";

revoke select on table "public"."profiles_timeoff_rules" from "authenticated";

revoke trigger on table "public"."profiles_timeoff_rules" from "authenticated";

revoke truncate on table "public"."profiles_timeoff_rules" from "authenticated";

revoke update on table "public"."profiles_timeoff_rules" from "authenticated";

revoke delete on table "public"."profiles_timeoff_rules" from "service_role";

revoke insert on table "public"."profiles_timeoff_rules" from "service_role";

revoke references on table "public"."profiles_timeoff_rules" from "service_role";

revoke select on table "public"."profiles_timeoff_rules" from "service_role";

revoke trigger on table "public"."profiles_timeoff_rules" from "service_role";

revoke truncate on table "public"."profiles_timeoff_rules" from "service_role";

revoke update on table "public"."profiles_timeoff_rules" from "service_role";

alter table "public"."profiles_timeoff_rules" drop constraint "profiles_timeoff_rules_profile_id_fkey";

alter table "public"."profiles_timeoff_rules" drop constraint "profiles_timeoff_rules_time_off_rule_id_fkey";

drop function if exists "public"."get_profile_with_time_off_balance"(target_user_id uuid);

alter table "public"."profiles_timeoff_rules" drop constraint "profiles_timeoff_rules_pkey";

drop index if exists "public"."profiles_timeoff_rules_pkey";

drop table "public"."profiles_timeoff_rules";


