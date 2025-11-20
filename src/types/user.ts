import { UserRole } from "@/hooks/useUserRoles";

export interface User {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    hourly_rate: number;
    team: string | null;
    role: UserRole | null;
}
