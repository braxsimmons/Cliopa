alter table "public"."time_corrections" drop column "original_end_time";

alter table "public"."time_corrections" add column "requested_start_time" timestamp with time zone;

alter table "public"."time_corrections" alter column "requested_end_time" drop not null;

alter table "public"."time_corrections" alter column "team" drop default;

alter table "public"."time_corrections" alter column "team" drop not null;
