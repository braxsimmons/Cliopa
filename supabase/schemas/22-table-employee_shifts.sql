CREATE TABLE public.employee_shifts (
	id UUID NOT NULL DEFAULT gen_random_uuid (),
	user_id UUID NOT NULL,
	day_of_week INTEGER NOT NULL,
	is_working_day BOOLEAN NULL DEFAULT TRUE,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
	morning_start TIME WITHOUT TIME ZONE NULL,
	morning_end time WITHOUT TIME ZONE NULL,
	afternoon_start TIME WITHOUT TIME ZONE NULL,
	afternoon_end time WITHOUT TIME ZONE NULL,
	CONSTRAINT employee_shifts_pkey PRIMARY KEY (id),
	CONSTRAINT employee_shifts_user_id_day_of_week_key UNIQUE (user_id, day_of_week),
	CONSTRAINT employee_shifts_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles (id) ON DELETE CASCADE,
	CONSTRAINT employee_shifts_day_of_week_check CHECK (
		(day_of_week >= 0)
		AND (day_of_week <= 6)
	)
)
TABLESPACE pg_default
;
