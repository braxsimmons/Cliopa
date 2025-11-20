CREATE TABLE public.approved_time_off (
	id UUID NOT NULL DEFAULT gen_random_uuid (),
	user_id UUID NOT NULL,
	request_id UUID NULL,
	start_date DATE NOT NULL,
	end_date DATE NOT NULL,
	days_taken NUMERIC NOT NULL,
	request_type TEXT NOT NULL,
	hourly_rate NUMERIC NULL,
	total_pay NUMERIC GENERATED ALWAYS AS (
		CASE
			WHEN (request_type = 'PTO'::text) THEN ((days_taken * (8)::NUMERIC) * hourly_rate)
			ELSE (0)::NUMERIC
		END
	) STORED NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
	CONSTRAINT approved_time_off_pkey PRIMARY key (id),
	CONSTRAINT approved_time_off_request_id_fkey FOREIGN KEY (request_id) REFERENCES time_off_requests (id) ON DELETE CASCADE,
	CONSTRAINT approved_time_off_request_type_check CHECK (
		request_type = ANY(ARRAY['PTO'::TEXT, 'UTO'::TEXT])
	)
)
TABLESPACE pg_default
;

CREATE INDEX IF NOT EXISTS idx_approved_time_off_user_date
	ON public.approved_time_off
	USING BTREE (user_id, start_date, end_date)
	TABLESPACE pg_default
;
