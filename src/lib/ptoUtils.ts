import { format, addYears, differenceInDays, startOfDay } from "date-fns";

export interface PTOInfo {
    annualAllowance: number;
    nextRefreshDate: string;
    daysUntilEligible?: number;
}

export const calculatePTOInfo = (startDate: string): PTOInfo => {
    const start = new Date(startDate);
    const today = startOfDay(new Date());
    const startOfEmployment = startOfDay(start);

    // Calculate days since start
    const daysSinceStart = differenceInDays(today, startOfEmployment);

    // Check if eligible (90+ days)
    const eligibleForPTO = daysSinceStart >= 90;
    const daysUntilEligible = eligibleForPTO ? 0 : 90 - daysSinceStart;

    // Calculate years of service
    const yearsOfService = Math.floor(daysSinceStart / 365.25);

    // Determine annual PTO allowance based on tenure
    let annualAllowance: number;
    if (yearsOfService === 0) {
        annualAllowance = 5; // Year 0-1
    } else if (yearsOfService <= 2) {
        annualAllowance = 10; // Years 1-2
    } else {
        annualAllowance = 15; // Years 3+
    }

    // Calculate next refresh date (anniversary of start date)
    let nextRefreshDate = addYears(start, yearsOfService + 1);

    // If we're past this year's anniversary, use next year's anniversary
    if (today >= addYears(start, yearsOfService)) {
        nextRefreshDate = addYears(start, yearsOfService + 1);
    } else {
        nextRefreshDate = addYears(start, yearsOfService);
    }

    return {
        annualAllowance,
        nextRefreshDate: format(nextRefreshDate, "MMM dd, yyyy"),
        daysUntilEligible: eligibleForPTO ? undefined : daysUntilEligible,
    };
};

export const getNextUTOResetDate = (): string => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth(); // 0-based

    // Quarters start in Jan (0), Apr (3), Jul (6), Oct (9)
    let nextQuarterMonth: number;
    let nextQuarterYear = currentYear;

    if (currentMonth < 3) {
        nextQuarterMonth = 3; // April
    } else if (currentMonth < 6) {
        nextQuarterMonth = 6; // July
    } else if (currentMonth < 9) {
        nextQuarterMonth = 9; // October
    } else {
        nextQuarterMonth = 0; // January of next year
        nextQuarterYear = currentYear + 1;
    }

    const nextResetDate = new Date(nextQuarterYear, nextQuarterMonth, 1);
    return format(nextResetDate, "MMM dd, yyyy");
};

export interface ApprovedPTOEntry {
    start_date: string;
    end_date: string;
    days_taken: number;
}

export interface PTOBalanceInfo extends PTOInfo {
    balance: number;
}
