import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Provides a back navigation handler that falls back to a default
 * path when there is no history entry to return to.
 */
export const useBack = (fallbackPath: string = "/dashboard") => {
  const navigate = useNavigate();

  return useCallback(() => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(fallbackPath, { replace: true });
    }
  }, [navigate, fallbackPath]);
};
