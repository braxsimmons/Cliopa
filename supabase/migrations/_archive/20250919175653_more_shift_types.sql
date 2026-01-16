alter table "public"."early_clock_attempts" add column "shift_type" text not null default ''::text;

alter table "public"."time_corrections" add column "shift_type" text;


