CREATE TRIGGER employee_shifts_updated_at
	BEFORE UPDATE ON employee_shifts
	FOR EACH ROW
	EXECUTE FUNCTION update_employee_shifts_updated_at()
;
