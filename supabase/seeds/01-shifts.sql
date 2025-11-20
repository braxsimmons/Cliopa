INSERT INTO public.employee_shifts (
	user_id, day_of_week, is_working_day, morning_start, morning_end, afternoon_start, afternoon_end
)
SELECT
	p.id
	, x.weekday
	, true AS is_working_day
	, '08:00' AS morning_start
	, '12:00' AS morning_end
	, '13:00' AS afternoon_start
	, '17:00' AS afternoon_end
FROM
  (VALUES (1), (2), (3), (4), (5)) AS x(weekday)
  CROSS JOIN public.profiles AS p
;
