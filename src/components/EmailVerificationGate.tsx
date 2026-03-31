import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { MailCheck, RefreshCw, LogOut } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const EmailVerificationGate = ({ children }: { children: React.ReactNode }) => {
  const { user, isGuest, isLoading, signOut } = useAuth();
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);
  const { toast } = useToast();
  const autoSentRef = useRef<string | null>(null);

  const isVerified = user?.email_confirmed_at != null;

  // Auto-send verification email once when an unverified user is detected
  useEffect(() => {
    if (!user?.email || isVerified || isLoading || isGuest) return;
    // Only send once per user per session
    if (autoSentRef.current === user.id) return;
    autoSentRef.current = user.id;

    supabase.auth.resend({ type: "signup", email: user.email }).then(({ error }) => {
      if (error) {
        console.error("Auto-resend verification failed:", error.message);
      } else {
        toast({ title: "Verification email sent!", description: "Check your inbox and spam folder." });
      }
    });
  }, [user, isVerified, isLoading, isGuest]);

  // Guest users or loading state — let them through
  if (isLoading || isGuest) return <>{children}</>;

  // Verified user — let them through
  if (isVerified) return <>{children}</>;

  // Unverified user — block access
  const handleResendVerification = async () => {
    if (!user?.email) return;
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: user.email,
    });
    setResending(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Verification email sent!", description: "Check your inbox and spam folder." });
    }
  };

  const handleCheckVerification = async () => {
    setChecking(true);
    const { data, error } = await supabase.auth.refreshSession();
    setChecking(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else if (data.user?.email_confirmed_at) {
      toast({ title: "Email verified!", description: "Welcome to EquityLens." });
    } else {
      toast({ title: "Not yet verified", description: "Please check your inbox and click the verification link.", variant: "destructive" });
    }
  };

  return (
    <Dialog open={true}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MailCheck className="h-5 w-5 text-primary" />
            Please Verify Your Email to Continue
          </DialogTitle>
          <DialogDescription>
            We've sent a verification link to <strong className="text-foreground">{user?.email}</strong>. 
            Please check your inbox (and spam folder) and click the link to access your dashboard.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 mt-2">
          <Button onClick={handleCheckVerification} disabled={checking} className="w-full gap-2">
            <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} />
            I've Verified — Check Now
          </Button>
          <Button variant="outline" onClick={handleResendVerification} disabled={resending} className="w-full gap-2">
            <MailCheck className="h-4 w-4" />
            {resending ? "Sending…" : "Resend Verification Email"}
          </Button>
          <Button variant="ghost" onClick={signOut} className="w-full gap-2 text-muted-foreground">
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmailVerificationGate;
