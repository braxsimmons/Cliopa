import { useState } from "react";
import { useAuth } from "./useAuth";
import { toast } from "@/components/ui/use-toast";
import { timeOffApprovalService } from "@/services/timeOffApprovalService";
import { TimeOffRequest } from "@/types/timeOffApproval";

export const useTimeOffApproval = () => {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const fetchPendingRequests = async (): Promise<TimeOffRequest[]> => {
    if (!user?.id) {
      console.log("No user ID available for fetchPendingRequests");
      return [];
    }

    return await timeOffApprovalService.fetchPendingRequests();
  };

  const approveRequest = async (requestId: string, approvalNotes?: string) => {
    if (!user?.id) {
      throw new Error("User not authenticated");
    }

    setLoading(true);
    try {
      await timeOffApprovalService.approveRequest(
        requestId,
        user.id,
        approvalNotes,
      );
    } catch (error) {
      console.error("Error approving request:", error);
      toast({
        title: "Error",
        description: "Failed to approve request",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const denyRequest = async (requestId: string, approvalNotes?: string) => {
    if (!user?.id) {
      throw new Error("User not authenticated");
    }

    setLoading(true);
    try {
      await timeOffApprovalService.denyRequest(
        requestId,
        user.id,
        approvalNotes,
      );
    } catch (error) {
      console.error("Error denying request:", error);
      toast({
        title: "Error",
        description: "Failed to deny request",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const exceptionRequest = async (requestId: string, approvalNotes?: string) => {
    if (!user?.id) {
      throw new Error("User not authenticated");
    }

    setLoading(true);
    try {
      await timeOffApprovalService.exceptionRequest(
        requestId,
        user.id,
        approvalNotes,
      );
    } catch (error) {
      console.error("Error approving exception request:", error);
      toast({
        title: "Error",
        description: "Error approving exception request",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    fetchPendingRequests,
    approveRequest,
    denyRequest,
    exceptionRequest,
    loading,
  };
};
