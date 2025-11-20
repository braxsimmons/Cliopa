CREATE TABLE public.early_clock_attempts (
	id UUID NOT NULL DEFAULT gen_random_uuid (),
	user_id UUID NOT NULL,
	attempted_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
	scheduled_start TIMESTAMP WITH TIME ZONE NOT NULL,
	actual_clock_in TIMESTAMP WITH TIME ZONE NULL,
	status TEXT NOT NULL DEFAULT 'pending'::TEXT,
	team TEXT NOT NULL DEFAULT ''::TEXT,
	shift_type TEXT NOT NULL DEFAULT ''::TEXT,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
	CONSTRAINT early_clock_attempts_pkey PRIMARY KEY (id),
	CONSTRAINT early_clock_attempts_status_check CHECK (
		status = any (
			array[
			'pending'::TEXT,
			'completed'::TEXT,
			'cancelled'::TEXT
			]
		)
	)
)
TABLESPACE pg_default
;
