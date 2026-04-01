import { useState } from "react";
import { Share2, Image, FileText, Link, Check, Loader2, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useStocks } from "@/contexts/StockContext";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import PremiumDialog from "@/components/PremiumDialog";

interface ShareExportButtonProps {
  tableRef: React.RefObject<HTMLDivElement>;
}

function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 24; i++) { result += chars.charAt(Math.floor(Math.random() * chars.length)); }
  return result;
}

const ShareExportButton = ({ tableRef }: ShareExportButtonProps) => {
  const { user, isGuest } = useAuth();
  const { stocks, activeWatchlist } = useStocks();
  const { isPremium } = useSubscription();
  const [isExporting, setIsExporting] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [premiumFeature, setPremiumFeature] = useState("");

  const getWatchlistName = () => activeWatchlist?.name || "Watchlist";

  const requirePremium = (feature: string) => {
    setPremiumFeature(feature);
    setPremiumOpen(true);
  };

  const exportAsImage = async () => {
    if (!isPremium) { requirePremium("Export as Image"); return; }
    if (!tableRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(tableRef.current, { backgroundColor: null, scale: 2, useCORS: true, logging: false });
      const link = document.createElement("a");
      link.download = `${getWatchlistName()}_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Watchlist exported as image");
    } catch (err) { console.error("Export image failed:", err); toast.error("Failed to export as image"); }
    finally { setIsExporting(false); }
  };

  const exportAsPDF = async () => {
    if (!isPremium) { requirePremium("Export as PDF"); return; }
    if (!tableRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(tableRef.current, { backgroundColor: "#ffffff", scale: 2, useCORS: true, logging: false });
      const imgData = canvas.toDataURL("image/png");
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const pdfWidth = 297;
      const pdf = new jsPDF({
        orientation: (imgHeight * pdfWidth / imgWidth) > pdfWidth ? "portrait" : "landscape",
        unit: "mm", format: "a4",
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const scaledHeight = (imgHeight * pageWidth) / imgWidth;
      pdf.addImage(imgData, "PNG", 0, 10, pageWidth, scaledHeight);
      pdf.save(`${getWatchlistName()}_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("Watchlist exported as PDF");
    } catch (err) { console.error("Export PDF failed:", err); toast.error("Failed to export as PDF"); }
    finally { setIsExporting(false); }
  };

  const generateShareLink = async () => {
    if (!user) { toast.error("Please sign in to share watchlists"); return; }
    if (!isPremium) { requirePremium("Shareable Watchlist Links"); return; }
    if (stocks.length === 0) { toast.error("No stocks to share"); return; }
    setIsExporting(true);
    try {
      const token = generateToken();
      const tickers = stocks.map(s => s.ticker);
      const stockSnapshot = stocks.map(s => ({
        ticker: s.ticker, name: s.name, exchange: s.exchange, price: s.price,
        change: s.change, changePercent: s.changePercent, high: s.high, low: s.low,
        volume: s.volume, marketCap: s.marketCap,
      }));
      const { error } = await supabase.from("shared_watchlists").insert({
        share_token: token, owner_id: user.id, watchlist_name: getWatchlistName(),
        tickers: JSON.stringify(tickers), stock_data: stockSnapshot,
      });
      if (error) { console.error("Failed to create share link:", error); toast.error("Failed to create share link"); return; }
      const shareUrl = `${window.location.origin}/shared/${token}`;
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      toast.success("Share link copied to clipboard!");
      setTimeout(() => setLinkCopied(false), 3000);
    } catch (err) { console.error("Share link failed:", err); toast.error("Failed to generate share link"); }
    finally { setIsExporting(false); }
  };

  const handleShareLink = () => {
    if (isGuest) {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Page link copied to clipboard!");
      return;
    }
    generateShareLink();
  };

  const showCrown = !isPremium;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5" disabled={isExporting}>
            {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Share</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={exportAsImage} className="cursor-pointer gap-2">
            <Image className="h-4 w-4" />
            Export as Image
            {showCrown && <Crown className="h-3 w-3 text-amber-500 ml-auto" />}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={exportAsPDF} className="cursor-pointer gap-2">
            <FileText className="h-4 w-4" />
            Export as PDF
            {showCrown && <Crown className="h-3 w-3 text-amber-500 ml-auto" />}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleShareLink} className="cursor-pointer gap-2">
            {linkCopied ? <Check className="h-4 w-4 text-gain" /> : <Link className="h-4 w-4" />}
            {linkCopied ? "Link Copied!" : "Copy Share Link"}
            {showCrown && !isGuest && <Crown className="h-3 w-3 text-amber-500 ml-auto" />}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <PremiumDialog open={premiumOpen} onOpenChange={setPremiumOpen} featureName={premiumFeature} />
    </>
  );
};

export default ShareExportButton;
