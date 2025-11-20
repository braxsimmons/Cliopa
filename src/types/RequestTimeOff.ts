export interface RequestTimeOff {
    request_type: "PTO" | "UTO";
    start_date: string;
    end_date: string;
    days_requested: number;
    reason?: string;
}
