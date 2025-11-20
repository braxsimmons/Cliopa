import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PayPeriodsSelectAllColumns } from "@/services/PayPeriodsService";
import { PayrollCalculationsSelectAllColumns } from "@/services/PayrollCalculationsService";
import { ProfileSelectBasic } from "@/services/ProfilesService";
import {
  HolidaysDelete,
  HolidaysInsert,
  HolidaysSelectAllColumns,
} from "@/services/HolidaysService";

export interface PayPeriod {
  id: string;
  start_date: string;
  end_date: string;
  period_type: "first_half" | "second_half";
  status: "open" | "processing" | "closed";
  created_at: string;
  updated_at: string;
}

export interface PayrollCalculation {
  id: string;
  user_id: string;
  pay_period_id: string;
  regular_hours: number;
  overtime_hours: number;
  holiday_hours: number;
  pto_hours: number;
  hourly_rate: number;
  regular_pay: number;
  overtime_pay: number;
  holiday_pay: number;
  pto_pay: number;
  total_gross_pay: number;
  profiles?: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  };
}

export interface Holiday {
  id: string;
  holiday_date: string;
  holiday_name: string;
  created_at: string;
}

export const usePayroll = () => {
  const [payPeriods, setPayPeriods] = useState<PayPeriod[]>([]);
  const [payrollCalculations, setPayrollCalculations] = useState<
    PayrollCalculation[]
  >([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchPayPeriods = async () => {
    try {
      const { data, error } = await PayPeriodsSelectAllColumns();

      if (error) throw error;
      setPayPeriods((data || []) as PayPeriod[]);
    } catch (error) {
      console.error("Error fetching pay periods:", error);
      toast({
        title: "Error",
        description: "Failed to fetch pay periods",
        variant: "destructive",
      });
    }
  };

  const fetchPayrollCalculations = async (payPeriodId?: string) => {
    try {
      const { payrollData, payrollError } =
        await PayrollCalculationsSelectAllColumns(payPeriodId);

      if (payrollError) throw payrollError;

      // Fetch profile data separately for each payroll calculation
      const calculations: PayrollCalculation[] = [];

      if (payrollData) {
        for (const calc of payrollData) {
          const { profiles, profilesError } = await ProfileSelectBasic(
            calc.user_id,
          );

          calculations.push({
            ...calc,
            profiles: profilesError ? undefined : profiles,
          } as PayrollCalculation);
        }
      }

      setPayrollCalculations(calculations);
    } catch (error) {
      console.error("Error fetching payroll calculations:", error);
      toast({
        title: "Error",
        description: "Failed to fetch payroll calculations",
        variant: "destructive",
      });
    }
  };

  const fetchHolidays = async () => {
    try {
      const { data, error } = await HolidaysSelectAllColumns();

      if (error) throw error;
      setHolidays(data || []);
    } catch (error) {
      console.error("Error fetching holidays:", error);
      toast({
        title: "Error",
        description: "Failed to fetch holidays",
        variant: "destructive",
      });
    }
  };

  const calculatePayrollForPeriod = async (payPeriodId: string) => {
    try {
      setLoading(true);
      const { error } = await supabase.rpc("calculate_payroll_for_period", {
        pay_period_id_param: payPeriodId,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Payroll calculated successfully",
      });

      await fetchPayrollCalculations(payPeriodId);
    } catch (error) {
      console.error("Error calculating payroll:", error);
      toast({
        title: "Error",
        description: "Failed to calculate payroll",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addHoliday = async (holidayDate: string, holidayName: string) => {
    try {
      const error = await HolidaysInsert({
        holiday_date: holidayDate,
        holiday_name: holidayName,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Holiday added successfully",
      });

      await fetchHolidays();
    } catch (error) {
      console.error("Error adding holiday:", error);
      toast({
        title: "Error",
        description: "Failed to add holiday",
        variant: "destructive",
      });
    }
  };

  const bulkAddHolidays = async (
    holidaysData: Array<{ date: string; name: string }>,
  ) => {
    try {
      setLoading(true);

      const holidaysToInsert = holidaysData.map((holiday) => ({
        holiday_date: holiday.date,
        holiday_name: holiday.name,
      }));

      const error = await HolidaysInsert(holidaysToInsert);

      if (error) throw error;

      toast({
        title: "Success",
        description: `${holidaysData.length} holidays added successfully`,
      });

      await fetchHolidays();
    } catch (error) {
      console.error("Error bulk adding holidays:", error);
      toast({
        title: "Error",
        description: "Failed to add holidays in bulk",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteHoliday = async (holidayId: string) => {
    try {
      const error = await HolidaysDelete(holidayId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Holiday deleted successfully",
      });

      await fetchHolidays();
    } catch (error) {
      console.error("Error deleting holiday:", error);
      toast({
        title: "Error",
        description: "Failed to delete holiday",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchPayPeriods(), fetchHolidays()]);
      setLoading(false);
    };

    loadData();
  }, []);

  return {
    payPeriods,
    payrollCalculations,
    holidays,
    loading,
    fetchPayPeriods,
    fetchPayrollCalculations,
    fetchHolidays,
    calculatePayrollForPeriod,
    addHoliday,
    bulkAddHolidays,
    deleteHoliday,
  };
};
