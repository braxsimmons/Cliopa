CREATE FUNCTION public.reset_quarterly_uto_balances()
RETURNS void
    LANGUAGE plpgsql
	SET search_path = ''
	SECURITY DEFINER
AS $$
BEGIN
	UPDATE public.profiles
	SET uto_balance = 3.00;
END;
$$;
