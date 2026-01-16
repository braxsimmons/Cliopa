create table "public"."time_off_rules" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null default ''::text,
    "value" numeric not null default 0,
    "reset_period" numeric not null default 0,
    "reset_unit" public.rule_unit not null,
    "not_before" numeric not null default 0,
    "not_before_unit" public.rule_unit not null,
    "team" text not null default ''::text
);

grant delete on table "public"."time_off_rules" to "anon";

grant insert on table "public"."time_off_rules" to "anon";

grant references on table "public"."time_off_rules" to "anon";

grant select on table "public"."time_off_rules" to "anon";

grant trigger on table "public"."time_off_rules" to "anon";

grant truncate on table "public"."time_off_rules" to "anon";

grant update on table "public"."time_off_rules" to "anon";

grant delete on table "public"."time_off_rules" to "authenticated";

grant insert on table "public"."time_off_rules" to "authenticated";

grant references on table "public"."time_off_rules" to "authenticated";

grant select on table "public"."time_off_rules" to "authenticated";

grant trigger on table "public"."time_off_rules" to "authenticated";

grant truncate on table "public"."time_off_rules" to "authenticated";

grant update on table "public"."time_off_rules" to "authenticated";

grant delete on table "public"."time_off_rules" to "service_role";

grant insert on table "public"."time_off_rules" to "service_role";

grant references on table "public"."time_off_rules" to "service_role";

grant select on table "public"."time_off_rules" to "service_role";

grant trigger on table "public"."time_off_rules" to "service_role";

grant truncate on table "public"."time_off_rules" to "service_role";

grant update on table "public"."time_off_rules" to "service_role";
