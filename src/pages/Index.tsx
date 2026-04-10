import Header from "@/components/Header";
import StockTable from "@/components/StockTable";
import EmailVerificationGate from "@/components/EmailVerificationGate";
import ReviewDialog from "@/components/ReviewDialog";
import SubscriptionGate from "@/components/SubscriptionGate";

const Index = () => {
  return (
    <SubscriptionGate>
      <EmailVerificationGate>
        <div className="min-h-screen bg-background">
          <Header />
          <StockTable />
          <ReviewDialog />
        </div>
      </EmailVerificationGate>
    </SubscriptionGate>
  );
};

export default Index;
