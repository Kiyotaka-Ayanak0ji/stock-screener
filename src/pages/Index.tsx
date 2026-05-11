import Header from "@/components/Header";
import StockTable from "@/components/StockTable";
import EmailVerificationGate from "@/components/EmailVerificationGate";
import ReviewDialog from "@/components/ReviewDialog";
import SubscriptionGate from "@/components/SubscriptionGate";
import BottomNav from "@/components/BottomNav";

const Index = () => {
  return (
    <SubscriptionGate>
      <EmailVerificationGate>
        <div className="min-h-screen bg-background pb-bottom-nav">
          <Header />
          <StockTable />
          <ReviewDialog />
          <BottomNav />
        </div>
      </EmailVerificationGate>
    </SubscriptionGate>
  );
};

export default Index;
