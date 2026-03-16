import Header from "@/components/Header";
import StockTable from "@/components/StockTable";
import EmailVerificationGate from "@/components/EmailVerificationGate";

const Index = () => {
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
