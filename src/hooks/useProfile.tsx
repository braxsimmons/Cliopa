import { useState, useEffect } from "react";
import { useAuth } from "./useAuth";
import { ProfileSelectAllColumnsForAUser } from "@/services/ProfilesService";

export interface Profile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  hourly_rate: number;
  start_date: string | null;
  birthday: string | null;
  team: string | null;
  role: string | null;
  uto_name: string | null;
  max_uto: number | null;
  pending_uto_request: number | null;
  available_uto: number | null;
  pto_name: string | null;
  max_pto: number | null;
  pending_pto_request: number | null;
  available_pto: number | null;
  time_off_start_date_pto: string | null;
  time_off_end_date_pto: string | null;
  time_off_start_date_uto: string | null;
  time_off_end_date_uto: string | null;
  pto_id: string | null;
  uto_id: string | null;
}

export const useProfile = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      console.log("User authenticated, fetching profile for user:", user.id);
      fetchProfile();
    } else {
      console.log("No user authenticated, clearing profile");
      setProfile(null);
      setLoading(false);
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user?.id) {
      console.log("No user ID available for fetchProfile");
      setLoading(false);
      return;
    }

    console.log("Fetching profile for user:", user.id);

    try {
      const data = await ProfileSelectAllColumnsForAUser(user.id);

      setProfile(data);
    } catch (error) {
      console.error("Unexpected error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  return { profile, loading, refetchProfile: fetchProfile };
};
