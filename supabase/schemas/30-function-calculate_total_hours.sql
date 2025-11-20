CREATE FUNCTION public.calculate_total_hours()
RETURNS trigger
    LANGUAGE plpgsql
	SET search_path = ''
    AS $$
BEGIN
	IF NEW.end_time IS NOT NULL
		AND NEW.start_time IS NOT NULL THEN
		NEW.total_hours = EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 3600.0;
		NEW.status = 'completed';
	END IF;
	NEW.updated_at = NOW();
	RETURN NEW;
END;
$$;
