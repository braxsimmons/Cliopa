import { useState, useEffect } from "react";
import { useAuth } from "./useAuth";
import {
  TimeOffRequestBalance,
  TimeOffRequestDelete,
  TimeOffRequestInsert,
  TimeOffRequestSelectAllForAUser,
} from "@/services/TimeOffRequestsService";
import { RequestTimeOff } from "@/types/RequestTimeOff";

interface TimeOffRequest {
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
  approval_notes: string | null;
}

export const useTimeOffRequests = () => {
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchRequests();
    }
  }, [user]);

  const fetchRequests = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      // Using the supabase client with proper type casting for the new table
      const { data, error } = await TimeOffRequestSelectAllForAUser(user.id);

      if (error) {
        console.error("Error fetching time off requests:", error);
      } else {
        setRequests((data as unknown as TimeOffRequest[]) || []);
      }
    } catch (error) {
      console.error("Unexpected error fetching time off requests:", error);
    } finally {
      setLoading(false);
    }
  };

  const submitRequest = async (requestData: RequestTimeOff) => {
    if (!user?.id) {
      throw new Error("User not authenticated");
    }

    const error = await TimeOffRequestInsert(user.id, requestData);

    if (error) {
      throw error;
    }

    // Refresh the list
    await fetchRequests();
  };

  const deleteRequest = async (requestId: string) => {
     if (!user?.id) {
      throw new Error("User not authenticated");
    }
    const error = await TimeOffRequestDelete(requestId);

    if (error) {
      console.error("Unexpected error deleting time off requests:", error);
    }
    // Refresh the list
    await fetchRequests();
  };

  const getBalance = async (startDate: Date, endDate:Date, timeOffId: string) => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    const data = await TimeOffRequestBalance(user.id, startDate, endDate, timeOffId)
    return data
  }

  return {
    requests,
    loading,
    submitRequest,
    refetch: fetchRequests,
    deleteRequest,
    getBalance,
  };
};
