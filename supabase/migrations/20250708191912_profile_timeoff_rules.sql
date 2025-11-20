create table "public"."profiles_timeoff_rules" (
    "profile_id" uuid not null,
    "time_off_rule_id" uuid not null
);


CREATE UNIQUE INDEX profiles_timeoff_rules_pkey ON public.profiles_timeoff_rules USING btree (profile_id, time_off_rule_id);

CREATE UNIQUE INDEX time_off_rules_pkey ON public.time_off_rules USING btree (id);

alter table "public"."profiles_timeoff_rules" add constraint "profiles_timeoff_rules_pkey" PRIMARY KEY using index "profiles_timeoff_rules_pkey";

alter table "public"."time_off_rules" add constraint "time_off_rules_pkey" PRIMARY KEY using index "time_off_rules_pkey";

alter table "public"."profiles_timeoff_rules" add constraint "profiles_timeoff_rules_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE not valid;

alter table "public"."profiles_timeoff_rules" validate constraint "profiles_timeoff_rules_profile_id_fkey";

alter table "public"."profiles_timeoff_rules" add constraint "profiles_timeoff_rules_time_off_rule_id_fkey" FOREIGN KEY (time_off_rule_id) REFERENCES time_off_rules(id) ON DELETE CASCADE not valid;

alter table "public"."profiles_timeoff_rules" validate constraint "profiles_timeoff_rules_time_off_rule_id_fkey";

grant delete on table "public"."profiles_timeoff_rules" to "anon";

grant insert on table "public"."profiles_timeoff_rules" to "anon";

grant references on table "public"."profiles_timeoff_rules" to "anon";

grant select on table "public"."profiles_timeoff_rules" to "anon";

grant trigger on table "public"."profiles_timeoff_rules" to "anon";

grant truncate on table "public"."profiles_timeoff_rules" to "anon";

grant update on table "public"."profiles_timeoff_rules" to "anon";

grant delete on table "public"."profiles_timeoff_rules" to "authenticated";

grant insert on table "public"."profiles_timeoff_rules" to "authenticated";

grant references on table "public"."profiles_timeoff_rules" to "authenticated";

grant select on table "public"."profiles_timeoff_rules" to "authenticated";

grant trigger on table "public"."profiles_timeoff_rules" to "authenticated";

grant truncate on table "public"."profiles_timeoff_rules" to "authenticated";

grant update on table "public"."profiles_timeoff_rules" to "authenticated";

grant delete on table "public"."profiles_timeoff_rules" to "service_role";

grant insert on table "public"."profiles_timeoff_rules" to "service_role";

grant references on table "public"."profiles_timeoff_rules" to "service_role";

grant select on table "public"."profiles_timeoff_rules" to "service_role";

grant trigger on table "public"."profiles_timeoff_rules" to "service_role";

grant truncate on table "public"."profiles_timeoff_rules" to "service_role";

grant update on table "public"."profiles_timeoff_rules" to "service_role";


