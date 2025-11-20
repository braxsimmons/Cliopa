export interface TimeOffRequest {
    id: string;
    user_id: string;
    request_type: "PTO" | "UTO";
    start_date: string;
    end_date: string;
    days_requested: number;
    reason: string | null;
    status: "pending" | "approved" | "denied";
    created_at: string;
    approval_notes: string | null;
    profiles?: {
        first_name: string | null;
        last_name: string | null;
        email: string;
        team: string | null;
    } | null;
}
