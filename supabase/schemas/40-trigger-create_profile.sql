CREATE TRIGGER insert_new_profile
    AFTER INSERT ON auth.users
    FOR EACH ROW
        EXECUTE FUNCTION handle_new_user()
;