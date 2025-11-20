import { useState, useEffect } from "react";
import { useAuth } from "./useAuth";
import { TimeOffRequestsSelectAllColumns } from "@/services/TimeOffRequestsService";

export interface TimeOffRequestWithProfile {
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
  profiles: {
    first_name: string | null;
    last_name: string | null;
    email: string;
    team: string | null;
  } | null;
}

export const useAllTimeOffRequests = () => {
  const [requests, setRequests] = useState<TimeOffRequestWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchAllRequests();
    }
  }, [user]);

  const fetchAllRequests = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      // First fetch all time off requests
      const { timeOffRequests, requestsError } =
        await TimeOffRequestsSelectAllColumns();

      if (requestsError) {
        console.error("Error fetching time off requests:", requestsError);
        setRequests([]);
        return;
      }

      if (!timeOffRequests || timeOffRequests.length === 0) {
        setRequests([]);
        return;
      }

      const requestsWithProfiles =
        timeOffRequests as TimeOffRequestWithProfile[];
      setRequests(requestsWithProfiles);
    } catch (error) {
      console.error("Unexpected error fetching all time off requests:", error);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  return { requests, loading, refetch: fetchAllRequests };
};
