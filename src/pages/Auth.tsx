import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Loader2, ArrowLeft, Mail, Lock as LockIcon, UserPlus, AlertCircle, Eye, EyeOff, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { lovable } from "@/integrations/lovable";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [accountExists, setAccountExists] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const passwordChecks = [
    { label: "At least 8 characters", ok: password.length >= 8 },
    { label: "One uppercase letter (A–Z)", ok: /[A-Z]/.test(password) },
    { label: "One lowercase letter (a–z)", ok: /[a-z]/.test(password) },
    { label: "One number (0–9)", ok: /\d/.test(password) },
    { label: "One special character (e.g. ! @ # $)", ok: /[^A-Za-z0-9]/.test(password) },
    { label: "Not a common or breached password", ok: password.length > 0 && !/^(password|test@?\d{2,4}|qwerty|12345|abc123|letmein|admin)$/i.test(password) },
  ];

  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const switchMode = (toLogin: boolean) => {
    setIsLogin(toLogin);
    setAccountExists(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAccountExists(false);

    let result;
    if (isLogin) {
      result = await signIn(email, password);
    } else {
      if (!displayName.trim()) {
        toast({ title: "Display name required", variant: "destructive" });
        setLoading(false);
        return;
      }
      result = await signUp(email, password, displayName);
    }

    setLoading(false);

    if (result.error) {
      if (!isLogin && result.error === "ACCOUNT_EXISTS") {
        setAccountExists(true);
        return;
      }
      const raw = result.error.toLowerCase();
      let friendly = result.error;
      if (raw.includes("pwned") || raw.includes("compromised") || raw.includes("leaked") || raw.includes("weak") || (raw.includes("password") && raw.includes("known"))) {
        friendly = "This password has appeared in a known data breach. Please choose a longer, unique password you haven't used elsewhere (avoid common patterns like 'test@2026' or 'password123').";
      }
      toast({ title: "Error", description: friendly, variant: "destructive" });

    } else {
      if (isLogin) {
        navigate("/dashboard");
      } else {
        toast({
          title: "Account created!",
          description: "Check your email to confirm your account, then log in. Can't find the email? Please check your spam or junk folder.",
        });
        setIsLogin(true);
      }
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <motion.div
          className="flex items-center justify-center gap-2 mb-8"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <TrendingUp className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold">
            Equity<span className="text-primary">IQ</span>
          </h1>
        </motion.div>

        <Card className="shadow-lg border-border/60 overflow-hidden">
          <CardHeader className="pb-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={isLogin ? "login" : "signup"}
                initial={{ opacity: 0, x: isLogin ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: isLogin ? 20 : -20 }}
                transition={{ duration: 0.2 }}
              >
                <CardTitle className="text-xl">{isLogin ? "Welcome back" : "Create account"}</CardTitle>
                <CardDescription className="mt-1">
                  {isLogin
                    ? "Sign in to sync your watchlist across devices"
                    : "Sign up to save your preferences securely"}
                </CardDescription>
              </motion.div>
            </AnimatePresence>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <AnimatePresence>
                {accountExists && !isLogin && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm"
                    role="alert"
                  >
                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-destructive font-medium">Account already exists</p>
                      <p className="text-muted-foreground text-xs mt-0.5">
                        An account with <span className="font-medium text-foreground">{email}</span> is already registered.{" "}
                        <button
                          type="button"
                          onClick={() => switchMode(true)}
                          className="text-primary hover:underline font-medium"
                        >
                          Sign in instead
                        </button>
                        .
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <AnimatePresence>
                {!isLogin && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-2 overflow-hidden"
                  >
                    <Label htmlFor="displayName">Display Name</Label>
                    <div className="relative">
                      <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="displayName"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Your name"
                        required
                        maxLength={100}
                        className="pl-9"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    maxLength={255}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <LockIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    maxLength={128}
                    className="pl-9 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground rounded-md transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {!isLogin && (
                  <div className="rounded-md border border-border/60 bg-muted/30 p-3 space-y-2">
                    <p className="text-xs font-medium text-foreground">
                      Your password should include:
                    </p>
                    <ul className="space-y-1">
                      {passwordChecks.map((c) => (
                        <li key={c.label} className="flex items-center gap-2 text-xs">
                          {c.ok ? (
                            <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                          ) : (
                            <X className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          )}
                          <span className={c.ok ? "text-foreground" : "text-muted-foreground"}>
                            {c.label}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                      Tip: avoid personal info, dictionary words, or patterns like <code>test@2026</code>. A short passphrase such as <code>Trout-Piano-Kite!92</code> works well.
                    </p>
                  </div>
                )}
              </div>


              <Button type="submit" className="w-full h-11 text-sm font-semibold transition-all active:scale-[0.98]" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {isLogin ? "Sign In" : "Sign Up"}
              </Button>
            </form>

            <div className="mt-5 text-center text-sm">
              <span className="text-muted-foreground">
                {isLogin ? "Don't have an account?" : "Already have an account?"}
              </span>{" "}
              <button
                onClick={() => switchMode(!isLogin)}
                className="text-primary hover:underline font-medium transition-colors"
              >
                {isLogin ? "Sign Up" : "Sign In"}
              </button>
            </div>

            <div className="mt-5 pt-4 border-t border-border">
              <Button
                variant="ghost"
                className="w-full gap-2 text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => navigate("/dashboard")}
              >
                <ArrowLeft className="h-4 w-4" />
                Continue as Guest
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Guest data is stored locally and won't sync across devices
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default Auth;
