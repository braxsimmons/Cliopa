CREATE FUNCTION public.update_pto_balance_on_time_off()
RETURNS trigger
    LANGUAGE plpgsql
	SET search_path = ''
	SECURITY DEFINER
AS $$
BEGIN
	IF NEW.time_off_type = 'PTO' THEN
		UPDATE public.profiles
		SET pto_balance = pto_balance - NEW.days_taken
		WHERE id = NEW.user_id;
	END IF;
	RETURN NEW;
END;
$$;
