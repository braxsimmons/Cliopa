CREATE FUNCTION public.generate_pay_periods_for_year(
	year_param integer
) RETURNS void
    LANGUAGE plpgsql
	SET search_path = ''
	SECURITY DEFINER
    AS $$
DECLARE
  month_num INTEGER;
  first_half_start DATE;
  first_half_end DATE;
  second_half_start DATE;
  second_half_end DATE;
BEGIN
  FOR month_num IN 1..12 LOOP
    -- First half: 8th to 23rd
    first_half_start := DATE(year_param || '-' || LPAD(month_num::TEXT, 2, '0') || '-08');
    first_half_end := DATE(year_param || '-' || LPAD(month_num::TEXT, 2, '0') || '-23');

    -- Second half: 24th to 7th of next month
    second_half_start := DATE(year_param || '-' || LPAD(month_num::TEXT, 2, '0') || '-24');
    IF month_num = 12 THEN
      second_half_end := DATE((year_param + 1) || '-01-07');
    ELSE
      second_half_end := DATE(year_param || '-' || LPAD((month_num + 1)::TEXT, 2, '0') || '-07');
    END IF;

    -- Insert pay periods
    INSERT INTO public.pay_periods (start_date, end_date, period_type)
    VALUES
      (first_half_start, first_half_end, 'first_half'),
      (second_half_start, second_half_end, 'second_half')
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;
