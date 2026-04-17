import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Loader2, ArrowLeft, Mail, Lock as LockIcon, UserPlus, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [accountExists, setAccountExists] = useState(false);
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
      toast({ title: "Error", description: result.error, variant: "destructive" });
    } else {
      if (isLogin) {
        navigate("/dashboard");
      } else {
        toast({
          title: "Account created!",
          description: "Check your email to confirm your account, then log in.",
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
            Equity<span className="text-primary">Lens</span>
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
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    maxLength={128}
                    className="pl-9"
                  />
                </div>
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
                onClick={() => setIsLogin(!isLogin)}
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
