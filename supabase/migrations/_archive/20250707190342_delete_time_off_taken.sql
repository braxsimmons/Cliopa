drop trigger if exists "update_balances_trigger" on "public"."time_off_taken";

drop trigger if exists "update_time_off_taken_updated_at" on "public"."time_off_taken";

drop policy "Admins can update time off taken records" on "public"."time_off_taken";

revoke delete on table "public"."time_off_taken" from "anon";

revoke insert on table "public"."time_off_taken" from "anon";

revoke references on table "public"."time_off_taken" from "anon";

revoke select on table "public"."time_off_taken" from "anon";

revoke trigger on table "public"."time_off_taken" from "anon";

revoke truncate on table "public"."time_off_taken" from "anon";

revoke update on table "public"."time_off_taken" from "anon";

revoke delete on table "public"."time_off_taken" from "authenticated";

revoke insert on table "public"."time_off_taken" from "authenticated";

revoke references on table "public"."time_off_taken" from "authenticated";

revoke select on table "public"."time_off_taken" from "authenticated";

revoke trigger on table "public"."time_off_taken" from "authenticated";

revoke truncate on table "public"."time_off_taken" from "authenticated";

revoke update on table "public"."time_off_taken" from "authenticated";

revoke delete on table "public"."time_off_taken" from "service_role";

revoke insert on table "public"."time_off_taken" from "service_role";

revoke references on table "public"."time_off_taken" from "service_role";

revoke select on table "public"."time_off_taken" from "service_role";

revoke trigger on table "public"."time_off_taken" from "service_role";

revoke truncate on table "public"."time_off_taken" from "service_role";

revoke update on table "public"."time_off_taken" from "service_role";

alter table "public"."time_off_taken" drop constraint "time_off_taken_type_check";

alter table "public"."time_off_taken" drop constraint "time_off_taken_user_id_fkey";

drop function if exists "public"."update_balances_on_time_off"();

drop function if exists "public"."update_updated_at_column"();

alter table "public"."time_off_taken" drop constraint "time_off_taken_pkey";

drop index if exists "public"."idx_time_off_taken_request_id";

drop index if exists "public"."idx_time_off_taken_user_id";

drop index if exists "public"."time_off_taken_pkey";

drop table "public"."time_off_taken";
