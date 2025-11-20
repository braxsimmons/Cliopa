import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { ProfileVerifyPtoRule } from "@/services/ProfilesService";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    firstName?: string,
    lastName?: string,
  ) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    const initializeAuth = async () => {
      try {
        console.log("Initializing auth...");
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error("Error getting session:", error);
          toast({
            title: "Authentication Error",
            description: error.message || "Failed to get session",
            variant: "destructive",
          });
        } else {
          console.log("Initial session:", session);
          setSession(session);
          setUser(session?.user ?? null);
        }
      } catch (error) {
        console.error("Unexpected error during auth initialization:", error);
        toast({
          title: "Connection Error",
          description:
            "Failed to connect to authentication service. Please check your internet connection.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state changed:", event, session);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      console.log("Attempting to sign in with email:", email);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("Sign in error:", error);
        let errorMessage = "Failed to sign in";

        if (error.message.includes("Invalid login credentials")) {
          errorMessage =
            "Invalid email or password. Please check your credentials and try again.";
        } else if (error.message.includes("Email not confirmed")) {
          errorMessage =
            "Please check your email and click the confirmation link before signing in.";
        } else if (error.message.includes("fetch")) {
          errorMessage =
            "Connection failed. Please check your internet connection and try again.";
        }

        toast({
          title: "Sign In Failed",
          description: errorMessage,
          variant: "destructive",
        });
        throw error;
      }

      console.log("Sign in successful:", data);
      ProfileVerifyPtoRule(data.user.id)
      toast({
        title: "Welcome back!",
        description: "You have successfully signed in.",
      });
    } catch (error) {
      console.error("Unexpected sign in error:", error);
      if (error instanceof Error && error.message.includes("fetch")) {
        toast({
          title: "Connection Error",
          description:
            "Unable to connect to the server. Please check your internet connection and try again.",
          variant: "destructive",
        });
      }
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (
    email: string,
    password: string,
    firstName?: string,
    lastName?: string,
  ) => {
    try {
      setLoading(true);
      console.log("Attempting to sign up with email:", email);

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName || "",
            last_name: lastName || "",
          },
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) {
        console.error("Sign up error:", error);
        let errorMessage = "Failed to create account";

        if (error.message.includes("already registered")) {
          errorMessage =
            "An account with this email already exists. Please sign in instead.";
        } else if (error.message.includes("fetch")) {
          errorMessage =
            "Connection failed. Please check your internet connection and try again.";
        }

        toast({
          title: "Sign Up Failed",
          description: errorMessage,
          variant: "destructive",
        });
        throw error;
      }

      console.log("Sign up successful:", data);
      toast({
        title: "Account Created!",
        description: "Please check your email for a confirmation link.",
      });
    } catch (error) {
      console.error("Unexpected sign up error:", error);
      if (error instanceof Error && error.message.includes("fetch")) {
        toast({
          title: "Connection Error",
          description:
            "Unable to connect to the server. Please check your internet connection and try again.",
          variant: "destructive",
        });
      }
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error("Sign out error:", error);
        toast({
          title: "Sign Out Failed",
          description: error.message || "Failed to sign out",
          variant: "destructive",
        });
        throw error;
      }

      toast({
        title: "Signed Out",
        description: "You have been successfully signed out.",
      });
    } catch (error) {
      console.error("Unexpected sign out error:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/dashboard`,
      });

      if (error) {
        console.error("Password reset error:", error);
        toast({
          title: "Reset Failed",
          description: error.message || "Failed to send reset email",
          variant: "destructive",
        });
        throw error;
      }

      toast({
        title: "Reset Email Sent",
        description: "Please check your email for password reset instructions.",
      });
    } catch (error) {
      console.error("Unexpected password reset error:", error);
      throw error;
    }
  };

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
