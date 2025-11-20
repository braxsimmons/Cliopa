UPDATE public.profiles
SET
	first_name = SUBSTRING(email FROM '^\w+')
	, last_name = SUBSTRING(email FROM '\.(\w+)')
	, start_date = CURRENT_TIMESTAMP - '6 months'::interval
	, team = 'bisongreen'
;
