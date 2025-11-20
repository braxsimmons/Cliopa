import { supabase } from "@/integrations/supabase/client";

export const TimeOffRulesSelectAllPTOColumns = async () => {
    const { data, error } = await supabase
        .from("time_off_rules")
        .select(`id, name, value`)
        .like("name", "%PTO%");

    return { data, error };
};


export const TimeOffRulesSelectAllUtoColumns = async () => {
    const {data, error } = await supabase
        .from("time_off_rules")
        .select(`id, name, value`)
        .like("name", "%UTO%");

    return {data, error};
};
