CREATE TABLE public.time_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid (),
  user_id UUID NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NULL,
  total_hours NUMERIC(10, 2) NULL,
  status TEXT NOT NULL DEFAULT 'active'::TEXT,
  team TEXT NOT NULL DEFAULT ''::TEXT,
  shift_type TEXT NOT NULL DEFAULT ''::TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  verified TIMESTAMPTZ,
  CONSTRAINT time_entries_pkey PRIMARY KEY (id),
  CONSTRAINT time_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles (id) ON DELETE CASCADE,
  CONSTRAINT time_entries_status_check CHECK (
      status = ANY(ARRAY['active'::TEXT, 'completed'::TEXT])
  )
)
TABLESPACE pg_default
;

CREATE UNIQUE INDEX one_active_time_entry_per_user
  ON public.time_entries (user_id)
  WHERE status = 'active';
