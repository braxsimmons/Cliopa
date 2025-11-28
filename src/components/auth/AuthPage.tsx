import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import GoogleSignInButton from "./oath";
import { Sun, Moon, Eye, EyeOff } from "lucide-react";

export const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();

  // Initialize theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    setTheme(initialTheme);
    document.documentElement.classList.toggle('dark', initialTheme === 'dark');
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        await signIn(email, password);
      } else {
        await signUp(email, password, firstName, lastName);
        toast({
          title: "Success",
          description:
            "Account created successfully! Please check your email to verify your account.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error && error.message
            ? error.message
            : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] px-4 py-8">
      {/* Theme toggle button */}
      <button
        onClick={toggleTheme}
        className="fixed top-4 right-4 p-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-border)] transition-colors"
        aria-label="Toggle theme"
      >
        {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
      </button>

      <Card className="w-full max-w-md bg-[var(--color-surface)] border-[var(--color-border)] shadow-lg">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <img src="/cliopa.png" alt="Cliopa.io" className="w-20 h-20 object-contain" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-[var(--color-text)]">
              Cliopa.io
            </CardTitle>
            <p className="text-xs text-[var(--color-subtext)] mt-1">
              AI-Powered Workforce Management
            </p>
          </div>
          <CardDescription className="text-[var(--color-subtext)]">
            {isLogin ? "Welcome back! Sign in to your account" : "Create your account to get started"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col">
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-[var(--color-text)]">
                    First Name
                  </Label>
                  <Input
                    id="firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required={!isLogin}
                    placeholder="John"
                    className="bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-subtext)]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-[var(--color-text)]">
                    Last Name
                  </Label>
                  <Input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required={!isLogin}
                    placeholder="Doe"
                    className="bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-subtext)]"
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[var(--color-text)]">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-subtext)]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-[var(--color-text)]">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-subtext)] pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-subtext)] hover:text-[var(--color-text)] transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full h-11 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-medium"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  {isLogin ? "Signing in..." : "Creating account..."}
                </span>
              ) : (
                isLogin ? "Sign In" : "Create Account"
              )}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--color-border)]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-[var(--color-surface)] px-2 text-[var(--color-subtext)]">
                Or continue with
              </span>
            </div>
          </div>

          <GoogleSignInButton />

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-[var(--color-accent)] hover:underline font-medium"
            >
              {isLogin
                ? "Don't have an account? Sign up"
                : "Already have an account? Sign in"}
            </button>
          </div>

          <p className="mt-6 text-center text-xs text-[var(--color-subtext)]">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
