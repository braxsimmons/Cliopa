
alter table "public"."time_entries" drop constraint "time_entries_user_id_fkey";

alter table "public"."time_off_requests" drop constraint "time_off_requests_approved_by_fkey";

alter table "public"."time_off_requests" drop constraint "time_off_requests_user_id_fkey";

alter table "public"."time_entries" add constraint "time_entries_user_id_fkey" FOREIGN KEY (user_id) REFERENCES "public"."profiles"(id) ON DELETE CASCADE not valid;

alter table "public"."time_entries" validate constraint "time_entries_user_id_fkey";

alter table "public"."time_off_requests" add constraint "time_off_requests_approved_by_fkey" FOREIGN KEY (approved_by) REFERENCES "public"."profiles"(id) not valid;

alter table "public"."time_off_requests" validate constraint "time_off_requests_approved_by_fkey";

alter table "public"."time_off_requests" add constraint "time_off_requests_user_id_fkey" FOREIGN KEY (user_id) REFERENCES "public"."profiles"(id) ON DELETE CASCADE not valid;

alter table "public"."time_off_requests" validate constraint "time_off_requests_user_id_fkey";

alter table "public"."time_corrections" add constraint "time_corrections_time_entry_id_fkey" FOREIGN KEY (time_entry_id) REFERENCES time_entries(id) ON DELETE CASCADE not valid;

alter table "public"."time_corrections" validate constraint "time_corrections_time_entry_id_fkey";