import Header from "@/components/Header";
import StockTable from "@/components/StockTable";
import EmailVerificationGate from "@/components/EmailVerificationGate";
import ReviewDialog from "@/components/ReviewDialog";
import SubscriptionGate from "@/components/SubscriptionGate";
import DailySummaryCard from "@/components/DailySummaryCard";

const Index = () => {
  return (
    <SubscriptionGate>
      <EmailVerificationGate>
        <div className="min-h-screen bg-background">
          <Header />
          <div className="container mx-auto px-4 py-4">
            <DailySummaryCard />
          </div>
          <StockTable />
          <ReviewDialog />
        </div>
      </EmailVerificationGate>
    </SubscriptionGate>
  );
};

export default Index;
