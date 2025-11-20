import { useEffect, useState } from "react";
import { TimeOffRequestsSelectAllColumns } from "@/services/TimeOffRequestsService";

export interface UTOReportEntry {
  id: string;
  user_id: string;
  request_type: "PTO" | "UTO";
  start_date: string;
  end_date: string;
  days_requested: number;
  reason: string | null;
  status: "pending" | "approved" | "denied";
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  approved_by: string | null;
  profiles?: {
    first_name: string | null;
    last_name: string | null;
    email: string;
    team: string | null;
  } | null;
}

export const useUTOReport = () => {
  const [requests, setRequests] = useState<UTOReportEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUTOReport = async () => {
    setLoading(true);
    try {
      // Fetch all time off requests (PTO and UTO) with all statuses
      const { timeOffRequests, requestsError } =
        await TimeOffRequestsSelectAllColumns();

      if (requestsError) {
        console.error("Error fetching time off requests:", requestsError);
        setRequests([]);
        return;
      }

      setRequests(timeOffRequests);
    } catch (err) {
      console.error("Unexpected error fetching UTO report:", err);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUTOReport();
  }, []);

  return { requests, loading, refetch: fetchUTOReport };
};
