CREATE TABLE public.kpis (
  id UUID NOT NULL DEFAULT gen_random_uuid (),
  user_id UUID NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value NUMERIC(10, 2) NOT NULL,
  bonus_amount NUMERIC(10, 2) NULL DEFAULT 0.00,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT kpis_pkey PRIMARY KEY (id),
  CONSTRAINT kpis_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
)
TABLESPACE pg_default
;
