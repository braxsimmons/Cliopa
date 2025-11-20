CREATE TABLE public.profiles (
	id UUID NOT NULL,
	email TEXT NOT NULL,
	first_name TEXT NULL,
	last_name TEXT NULL,
	role public.app_role NOT NULL,
	hourly_rate NUMERIC(10, 2) NOT NULL DEFAULT 15.00,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
	start_date DATE NULL,
	birthday DATE NULL,
	team TEXT NULL,
	pto_rule UUID DEFAULT NULL,
	uto_rule UUID DEFAULT NULL,
	pto_rule_advance_at DATE NULL,
	employment_type TEXT NOT NULL DEFAULT 'Full-Time',
	CONSTRAINT profiles_pkey PRIMARY KEY (id),
	CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE,
	CONSTRAINT pto_rule_fkey FOREIGN KEY (pto_rule) REFERENCES public.time_off_rules(id),
	CONSTRAINT uto_rule_fkey FOREIGN KEY (uto_rule) REFERENCES public.time_off_rules(id)
)
TABLESPACE pg_default
;
