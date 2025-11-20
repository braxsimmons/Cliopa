CREATE TRIGGER calculate_hours_trigger
BEFORE UPDATE ON time_entries
FOR EACH ROW
EXECUTE FUNCTION calculate_total_hours();
