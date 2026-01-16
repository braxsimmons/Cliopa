CREATE UNIQUE INDEX one_active_time_entry_per_user ON public.time_entries USING btree (user_id) WHERE (status = 'active'::text);


