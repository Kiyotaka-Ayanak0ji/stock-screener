import Header from "@/components/Header";
import StockTable from "@/components/StockTable";
import EmailVerificationGate from "@/components/EmailVerificationGate";
import ReviewDialog from "@/components/ReviewDialog";
import SubscriptionGate from "@/components/SubscriptionGate";
import BottomNav from "@/components/BottomNav";
import RebrandBanner from "@/components/RebrandBanner";

const Index = () => {
  return (
    <SubscriptionGate>
      <EmailVerificationGate>
        <div className="min-h-screen bg-background pb-bottom-nav">
          <Header />
          <RebrandBanner />
          <StockTable />
          <ReviewDialog />
          <BottomNav />
        </div>
      </EmailVerificationGate>
    </SubscriptionGate>
  );
};

export default Index;

