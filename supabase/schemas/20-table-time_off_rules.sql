CREATE TABLE public.time_off_rules (
	id UUID NOT NULL DEFAULT gen_random_uuid (),
	name TEXT NOT NULL DEFAULT ''::TEXT,
	value NUMERIC NOT NULL DEFAULT 0,
	reset_period NUMERIC NOT NULL DEFAULT 0,
	reset_unit public.rule_unit NOT NULL,
	not_before NUMERIC NOT NULL DEFAULT 0,
	not_before_unit public.rule_unit NOT NULL,
	team TEXT NOT NULL DEFAULT ''::TEXT,
	progression UUID,
	CONSTRAINT time_off_rules_pkey PRIMARY KEY (id)
)
TABLESPACE pg_default
;
