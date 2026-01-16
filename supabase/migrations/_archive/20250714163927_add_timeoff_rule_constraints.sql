alter table "public"."profiles" add constraint "pto_rule_fkey" FOREIGN KEY (pto_rule) REFERENCES time_off_rules(id) not valid;

alter table "public"."profiles" validate constraint "pto_rule_fkey";

alter table "public"."profiles" add constraint "uto_rule_fkey" FOREIGN KEY (uto_rule) REFERENCES time_off_rules(id) not valid;

alter table "public"."profiles" validate constraint "uto_rule_fkey";


