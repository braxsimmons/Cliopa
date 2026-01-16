set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.auto_approve_time_corrections()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  WITH matches AS (
    SELECT
      c.id,
      c.time_entry_id,
      c.requested_end_time
    FROM
      public.time_corrections AS c
      LEFT JOIN public.employee_shifts AS e
        ON c.user_id = e.user_id
        AND extract(DOW FROM c.requested_end_time) = e.day_of_week
    WHERE
      c.status = 'pending'
      AND (
        (c.requested_end_time - ((DATE(c.requested_end_time) + e.morning_end) AT TIME ZONE 'America/Denver') AT TIME ZONE 'UTC') < INTERVAL '10 minutes'
        OR
        (c.requested_end_time - ((DATE(c.requested_end_time) + e.afternoon_end) AT TIME ZONE 'America/Denver') AT TIME ZONE 'UTC') < INTERVAL '10 minutes'
      )
  ),
  update_entries AS (
    UPDATE public.time_entries te
    SET
      end_time = m.requested_end_time,
      total_hours = EXTRACT(EPOCH FROM (m.requested_end_time - te.start_time)) / 3600.0,
      status = 'completed',
      updated_at = NOW()
    FROM matches m
    WHERE te.id = m.time_entry_id
    RETURNING m.id
  )
   , auto_approver_id AS (
	SELECT
		id
	FROM
		public.profiles
	WHERE
		email = 'autoapprover@tlcops.com'
  )
  UPDATE public.time_corrections
  SET
    status = 'approved',
    updated_at = NOW(),
    approved_at = NOW(),
	approved_by = (SELECT id FROM auto_approver_id)
  WHERE id IN (SELECT id FROM matches);
END;
$function$
;


INSERT INTO auth.users (
	instance_id,
	id,
	aud,
	role,
	email,
	encrypted_password,
	email_confirmed_at,
	recovery_sent_at,
	last_sign_in_at,
	raw_app_meta_data,
	raw_user_meta_data,
	created_at,
	updated_at,
	confirmation_token,
	email_change,
	email_change_token_new,
	recovery_token
) VALUES
	(
		'00000000-0000-0000-0000-000000000000',
		extensions.uuid_generate_v4(),
		'authenticated',
		'authenticated',
		'autoapprover@tlcops.com',
		extensions.crypt('password123', extensions.gen_salt('bf')),
		current_timestamp,
		current_timestamp,
		current_timestamp,
		'{"provider":"email","providers":["email"]}',
		'{"role":"admin"}',
		current_timestamp,
		current_timestamp,
		'',
		'',
		'',
		''
	)

;
