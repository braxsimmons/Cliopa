CREATE TABLE public.payroll_calculations (
	id UUID NOT NULL DEFAULT gen_random_uuid (),
	user_id UUID NOT NULL,
	pay_period_id UUID NOT NULL,
	regular_hours NUMERIC NOT NULL DEFAULT 0,
	overtime_hours NUMERIC NOT NULL DEFAULT 0,
	holiday_hours NUMERIC NOT NULL DEFAULT 0,
	pto_hours NUMERIC NOT NULL DEFAULT 0,
	hourly_rate NUMERIC NOT NULL,
	regular_pay NUMERIC NOT NULL DEFAULT 0,
	overtime_pay NUMERIC NOT NULL DEFAULT 0,
	holiday_pay NUMERIC NOT NULL DEFAULT 0,
	pto_pay NUMERIC NOT NULL DEFAULT 0,
	total_gross_pay NUMERIC NOT NULL DEFAULT 0,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
	CONSTRAINT payroll_calculations_pkey PRIMARY KEY (id),
	CONSTRAINT payroll_calculations_user_id_pay_period_id_key UNIQUE (user_id, pay_period_id),
	CONSTRAINT payroll_calculations_pay_period_id_fkey FOREIGN KEY (pay_period_id) REFERENCES pay_periods (id)
)
TABLESPACE pg_default
;
