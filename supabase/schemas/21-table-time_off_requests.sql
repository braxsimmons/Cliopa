CREATE TABLE public.time_off_requests (
	id UUID NOT NULL DEFAULT gen_random_uuid (),
	user_id UUID NOT NULL,
	request_type TEXT NOT NULL,
	start_date DATE NOT NULL,
	end_date DATE NOT NULL,
	days_requested NUMERIC NOT NULL,
	reason TEXT NULL,
	status TEXT NOT NULL DEFAULT 'pending'::TEXT,
	approved_by UUID NULL,
	approved_at TIMESTAMP WITH TIME ZONE NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
	approval_notes TEXT NULL,
	CONSTRAINT time_off_requests_pkey PRIMARY KEY (id),
	CONSTRAINT time_off_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.profiles (id),
	CONSTRAINT time_off_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles (id) ON DELETE CASCADE,
	CONSTRAINT time_off_requests_request_type_check CHECK (
		request_type = ANY(ARRAY['PTO'::TEXT, 'UTO'::TEXT])
	),
	CONSTRAINT time_off_requests_status_check CHECK (
		status = ANY(ARRAY['pending'::TEXT, 'approved'::TEXT, 'denied'::TEXT, 'exception'::TEXT])
	)
)
TABLESPACE pg_default
;

CREATE INDEX IF NOT EXISTS idx_time_off_requests_user_id
	ON public.time_off_requests
	USING BTREE (user_id)
	TABLESPACE pg_default
;

CREATE INDEX IF NOT EXISTS idx_time_off_requests_status
	ON public.time_off_requests
	USING BTREE (status)
	TABLESPACE pg_default
;
