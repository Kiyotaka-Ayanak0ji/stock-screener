import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { Loader2 } from "lucide-react";

interface SubscriptionGateProps {
  children: React.ReactNode;
}

/**
 * Wraps routes that require an active subscription or trial.
 * Expired-trial / inactive users are redirected to /subscribe.
 * Unauthenticated users are redirected to landing.
 */
const SubscriptionGate = ({ children }: SubscriptionGateProps) => {
  const { user, isLoading: authLoading } = useAuth();
  const { isActive, loading: subLoading, subscription } = useSubscription();
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/", { replace: true });
      return;
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (authLoading || subLoading) return;
    if (!user) return;
    // If there's a subscription record but it's not active, block access
    if (subscription && !isActive) {
      navigate("/subscribe", { replace: true });
      return;
    }
    // If there's no subscription record at all, also block
    if (!subscription) {
      navigate("/subscribe", { replace: true });
    }
  }, [authLoading, subLoading, user, subscription, isActive, navigate]);

  if (authLoading || subLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !isActive) return null;

  return <>{children}</>;
};

export default SubscriptionGate;
