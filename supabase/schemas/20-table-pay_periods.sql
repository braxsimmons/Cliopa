CREATE TABLE public.pay_periods (
	id UUID NOT NULL DEFAULT gen_random_uuid (),
	start_date DATE NOT NULL,
	end_date DATE NOT NULL,
	period_type TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'open'::TEXT,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
	CONSTRAINT pay_periods_pkey PRIMARY KEY (id),
	CONSTRAINT pay_periods_period_type_check CHECK (
		period_type = ANY(ARRAY['first_half'::TEXT, 'second_half'::TEXT])
	),
	CONSTRAINT pay_periods_status_check CHECK (
		status = ANY(ARRAY['open'::TEXT, 'processing'::TEXT, 'closed'::TEXT])
	)
)
TABLESPACE pg_default
;
