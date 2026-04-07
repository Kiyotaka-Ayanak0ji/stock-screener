import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { Loader2 } from "lucide-react";
import RestrictedDashboard from "@/pages/RestrictedDashboard";

interface SubscriptionGateProps {
  children: React.ReactNode;
}

/**
 * Wraps routes that require an active subscription or trial.
 * Expired-trial / inactive users see the restricted dashboard.
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
    }
  }, [authLoading, user, navigate]);

  if (authLoading || subLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  // No active subscription → show restricted dashboard
  if (!isActive) {
    return <RestrictedDashboard />;
  }

  return <>{children}</>;
};

export default SubscriptionGate;
