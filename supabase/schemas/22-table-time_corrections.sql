CREATE TABLE public.time_corrections (
	id UUID NOT NULL DEFAULT gen_random_uuid (),
	user_id UUID NOT NULL,
	time_entry_id UUID NOT NULL,
	requested_start_time TIMESTAMP WITH TIME ZONE,
	requested_end_time TIMESTAMP WITH TIME ZONE,
	reason TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'pending'::TEXT,
	team TEXT,
	shift_type TEXT,
	approved_by UUID NULL,
	approved_at TIMESTAMP WITH TIME ZONE NULL,
	review_notes TEXT NULL,
	created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
	CONSTRAINT time_corrections_pkey PRIMARY KEY (id),
	CONSTRAINT time_corrections_time_entry_id_fkey FOREIGN KEY (time_entry_id) REFERENCES public.time_entries (id) ON DELETE CASCADE,
	CONSTRAINT time_corrections_status_check CHECK (
		status = ANY(ARRAY['pending'::TEXT, 'approved'::TEXT, 'denied'::TEXT])
	)
)
TABLESPACE pg_default
;
