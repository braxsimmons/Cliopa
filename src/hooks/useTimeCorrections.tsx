import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";
import {
  TimeCorrectionSelectAllForAUser,
  TimeCorrectionSelectAllPendingCorrections,
  TimeCorrectionsInsert,
  TimeCorrectionsUpsert,
} from "@/services/TimeCorrectionsService";
import { TimeEntriesInsertManualShift } from "@/services/TimeEntriesService";

interface TimeCorrection {
  id: string;
  user_id: string;
  time_entry_id: string;
  original_end_time: string;
  requested_end_time: string;
  reason: string;
  status: "pending" | "approved" | "denied";
  approved_by?: string;
  approved_at?: string;
  approval_notes?: string;
  created_at: string;
  updated_at: string;
  profiles?: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

export const useTimeCorrections = () => {
  const [corrections, setCorrections] = useState<TimeCorrection[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const createTimeCorrection = async (
    timeEntryId: string,
    requestedStartTime: string,
    requestedEndTime: string,
    reason: string,
    requestedShiftType: string,
    team: string
  ) => {
    if (!user?.id) return;

    try {
      setLoading(true);
      //need to check for pending
      const { data: isPending, error: pendingError } = await supabase
        .from("time_corrections")
        .select(
          `
          id
          `
        )
        .eq("status", "pending")
        .eq("time_entry_id", timeEntryId);

      let data = null;
      let error = null;
      if (isPending.length > 0) {
        ({ data, error } = await TimeCorrectionsUpsert(
          isPending[0].id,
          user.id,
          timeEntryId,
          requestedStartTime,
          requestedEndTime,
          reason,
          team,
          requestedShiftType
        ));
      } else {
        ({ data, error } = await TimeCorrectionsInsert(
          user.id,
          timeEntryId,
          requestedStartTime,
          requestedEndTime,
          reason,
          team,
          requestedShiftType
        ));
      }
      if (error) throw error;

      toast({
        title: "Time Correction Submitted",
        description:
          "Your time correction request has been submitted for approval.",
      });

      return data;
    } catch (error) {
      console.error("Error creating time correction:", error);
      toast({
        title: "Error",
        description: "Failed to submit time correction request",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createManualTimeEntry = async (
    startTime: string,
    endTime: string,
    shiftType: string,
    team: string
  ) => {
    if (!user?.id) return;

    try {
      setLoading(true);

      const totalHours =
        (new Date(endTime).getTime() - new Date(startTime).getTime()) /
        (1000 * 60 * 60);

      const roundedHours = Math.round(totalHours * 100) / 100;
      const { data, error } = await TimeEntriesInsertManualShift(
        startTime,
        endTime,
        roundedHours,
        user.id,
        team,
        shiftType
      );
      if (error) throw error;

      toast({
        title: "Manual Entry Submitted",
        description: "Your manual time entry has been submitted for approval.",
      });

      return data;
    } catch (error) {
      console.error("Error creating manual time entry:", error);
      toast({
        title: "Error",
        description: "Failed to create manual time entry",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMyCorrections = async () => {
    if (!user?.id) return [];

    try {
      console.log("Fetching my time corrections...");

      const { corrections, error } = await TimeCorrectionSelectAllForAUser(
        user.id
      );

      if (error) {
        throw error;
      }

      console.log("Found my corrections:", corrections);
      return corrections || [];
    } catch (error) {
      console.error("Error in fetchMyCorrections:", error);
      return [];
    }
  };

  const fetchPendingCorrections = async () => {
    try {
      console.log("Fetching pending time corrections...");

      // First, get the corrections
      const { corrections, correctionsError } =
        await TimeCorrectionSelectAllPendingCorrections();

      if (correctionsError) {
        console.error("Error fetching corrections:", correctionsError);
        throw correctionsError;
      }

      if (!corrections || corrections.length === 0) {
        console.log("No pending corrections found");
        return [];
      }

      console.log("Found corrections:", corrections);

      console.log("Corrections with profiles:", corrections);
      return corrections;
    } catch (error) {
      console.error("Error in fetchPendingCorrections:", error);
      return [];
    }
  };

  const approveCorrection = async (correctionId: string, notes?: string) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase.rpc("approve_time_correction", {
        correction_id: correctionId,
        approver_id: user.id,
        notes: notes || null,
      });

      if (error) throw error;

      toast({
        title: "Time Correction Approved",
        description: "The time correction has been approved and applied.",
      });

      return true;
    } catch (error) {
      console.error("Error approving time correction:", error);
      toast({
        title: "Error",
        description: "Failed to approve time correction",
        variant: "destructive",
      });
      return false;
    }
  };

  const denyCorrection = async (correctionId: string, notes?: string) => {
    if (!user?.id) return;

    try {
      const { error } = await supabase.rpc("deny_time_correction", {
        correction_id: correctionId,
        notes: notes || null,
      });

      if (error) throw error;

      toast({
        title: "Time Correction Denied",
        description: "The time correction has been denied",
      });

      return true;
    } catch (error) {
      console.error("Error denying time correction:", error);
      toast({
        title: "Error",
        description: "Failed to deny time correction",
        variant: "destructive",
      });
      return false;
    }
  };

  return {
    corrections,
    loading,
    createTimeCorrection,
    fetchMyCorrections,
    fetchPendingCorrections,
    approveCorrection,
    denyCorrection,
    createManualTimeEntry,
  };
};
