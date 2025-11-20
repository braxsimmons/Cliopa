import { supabase } from "@/integrations/supabase/client";
import { useEffect, useRef } from "react";

export default function GoogleSignInButton() {
  const buttonRef = useRef(null);

  useEffect(() => {
    // Load Google Identity script dynamically
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;

    script.onload = () => {
      if (window.google && buttonRef.current) {
        window.google.accounts.id.initialize({
          client_id:
            "474735917970-f7a7sjf0vrmqd3epblhvso5sl51tav17.apps.googleusercontent.com",
          callback: (response) => {
            const token = response.credential;
            supabase.auth.signInWithIdToken({ provider: "google", token });
          },
        });

        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: "outline",
          size: "large",
          shape: "pill",
          text: "signin_with",
        });
      }
    };

    document.body.appendChild(script);
  }, []);

  return <div ref={buttonRef} className="mt-8 self-center" />;
}
