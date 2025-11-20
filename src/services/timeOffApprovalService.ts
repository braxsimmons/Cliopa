import { supabase } from "@/integrations/supabase/client";
import { TimeOffRequest } from "@/types/timeOffApproval";
import { toast } from "@/components/ui/use-toast";
import {
    TimeOffRequestsSelectAllColumnsPendingStatus,
    TimeOffRequestsUpdateApprovalNotes,
} from "@/services/TimeOffRequestsService";

export const timeOffApprovalService = {
    async fetchPendingRequests(): Promise<TimeOffRequest[]> {
        try {
            console.log("Fetching pending time off requests...");

            // First, let's try a simpler query to see all pending requests
            const { timeOffRequests, requestsError } =
                await TimeOffRequestsSelectAllColumnsPendingStatus();

            if (requestsError) {
                console.error(
                    "Error fetching pending requests:",
                    requestsError,
                );
                toast({
                    title: "Error",
                    description: "Failed to fetch pending requests",
                    variant: "destructive",
                });
                return [];
            }

            if (!timeOffRequests || timeOffRequests.length === 0) {
                console.log("No pending requests found");
                return [];
            }

            return timeOffRequests;
        } catch (error) {
            console.error("Unexpected error fetching pending requests:", error);
            toast({
                title: "Error",
                description:
                    "An unexpected error occurred while fetching requests",
                variant: "destructive",
            });
            return [];
        }
    },

    async approveRequest(
        requestId: string,
        approverId: string,
        approvalNotes?: string,
    ): Promise<void> {
        console.log(
            "Approving request:",
            requestId,
            "with notes:",
            approvalNotes,
        );

        // Update the request with approval notes
        const updateError = await TimeOffRequestsUpdateApprovalNotes(
            approvalNotes,
            requestId,
        );

        if (updateError) {
            console.error("Error updating approval notes:", updateError);
            throw updateError;
        }

        const { error } = await supabase.rpc("approve_time_off_request", {
            request_id: requestId,
            approver_id: approverId,
        });

        if (error) {
            console.error("Error approving request:", error);
            throw error;
        }

        // Send approval email notification
        try {
            await supabase.functions.invoke("send-time-off-notification", {
                body: {
                    request_id: requestId,
                    action: "approved",
                },
            });
        } catch (emailError) {
            console.warn("Failed to send email notification:", emailError);
            // Don't throw here as the main approval succeeded
        }

        toast({
            title: "Success",
            description: "Time off request approved successfully",
        });
    },

    async denyRequest(
        requestId: string,
        approverId: string,
        approvalNotes?: string,
    ): Promise<void> {
        console.log(
            "Denying request:",
            requestId,
            "with notes:",
            approvalNotes,
        );

        // Update the request with approval notes
        const updateError = await TimeOffRequestsUpdateApprovalNotes(
            approvalNotes,
            requestId,
        );

        if (updateError) {
            console.error("Error updating approval notes:", updateError);
            throw updateError;
        }

        const { error } = await supabase.rpc("deny_time_off_request", {
            request_id: requestId,
            approver_id: approverId,
        });

        if (error) {
            console.error("Error denying request:", error);
            throw error;
        }

        // Send denial email notification
        try {
            await supabase.functions.invoke("send-time-off-notification", {
                body: {
                    request_id: requestId,
                    action: "denied",
                },
            });
        } catch (emailError) {
            console.warn("Failed to send email notification:", emailError);
            // Don't throw here as the main denial succeeded
        }

        toast({
            title: "Success",
            description: "Time off request denied",
        });
    },

    async exceptionRequest(
        requestId: string,
        approverId: string,
        approvalNotes?: string,
    ): Promise<void> {
        console.log(
            "request exception:",
            requestId,
            "with notes:",
            approvalNotes,
        );

        // Update the request with approval notes
        const updateError = await TimeOffRequestsUpdateApprovalNotes(
            approvalNotes,
            requestId,
        );

        if (updateError) {
            console.error("Error updating approval notes:", updateError);
            throw updateError;
        }

        const { error } = await supabase.rpc("exception_time_off_request", {
            request_id: requestId,
            approver_id: approverId,
        });

        if (error) {
            console.error("Error approving exception request:", error);
            throw error;
        }

        toast({
            title: "Success",
            description: "Time off request marked as exception",
        });
    },
};
