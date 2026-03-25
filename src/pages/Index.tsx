import Header from "@/components/Header";
import StockTable from "@/components/StockTable";
import EmailVerificationGate from "@/components/EmailVerificationGate";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

const Index = () => {
  const { user, isLoading: authLoading } = useAuth();
  const { isActive, loading: subLoading, subscription } = useSubscription();
  const navigate = useNavigate();

   // Redirect unauthenticated users to landing
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/", { replace: true });
      return;
    }
  }, [authLoading, user, navigate]);

  // Block expired trial / expired subscription users
  useEffect(() => {
    if (authLoading || subLoading) return;
    if (!user) return; // guests can browse with limited features
    // If user has a subscription record and it's not active, redirect
    if (subscription && !isActive) {
      navigate("/subscribe", { replace: true });
    }
  }, [authLoading, subLoading, user, subscription, isActive, navigate]);

  if (authLoading || (user && subLoading)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <EmailVerificationGate>
      <div className="min-h-screen bg-background">
        <Header />
        <StockTable />
      </div>
    </EmailVerificationGate>
  );
};

export default Index;
