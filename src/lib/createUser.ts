import { createClient } from "@supabase/supabase-js";
import { UserRole } from "@/hooks/useUserRoles";
import { ProfilesPartialUpdate } from "@/services/ProfilesService";

export interface CreateUserInput {
    email: string;
    password: string;
    first_name?: string;
    last_name?: string;
    team?: string;
    hourly_rate?: number;
    start_date?: string;
    role?: UserRole | "";
    employment_type?: string;
}
/**
 * This createUser function is only used via the admin tab to manually create users.
 *
 *
 * - Joshua Frey
 */
export async function createUser({
    email,
    password,
    first_name,
    last_name,
    team,
    hourly_rate = 15,
    start_date,
    role,
    employment_type,
}: CreateUserInput): Promise<void> {
    const tempClient = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
        {
            auth: { persistSession: false },
        },
    );

    const { data: authData, error: authError } = await tempClient.auth.signUp({
        email,
        password,
        options: { data: { first_name, last_name } },
    });

    if (authError || !authData.user?.id) {
        throw new Error(authError?.message || "Failed to create user");
    }

    const userId = authData.user.id;

    const error = await ProfilesPartialUpdate(userId, {
        first_name,
        last_name,
        hourly_rate,
        role,
        team,
        start_date,
        employment_type
    });

    if (error) {
        throw new Error(error.message);
    }
}
