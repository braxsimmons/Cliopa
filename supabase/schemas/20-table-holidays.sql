CREATE TABLE public.holidays (
	id UUID NOT NULL DEFAULT gen_random_uuid (),
	holiday_date DATE NOT NULL,
	holiday_name TEXT NOT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
	CONSTRAINT holidays_pkey PRIMARY KEY (id),
	CONSTRAINT holidays_holiday_date_key UNIQUE (holiday_date)
)
TABLESPACE pg_default
;
