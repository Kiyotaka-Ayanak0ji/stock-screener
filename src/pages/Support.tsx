import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LifeBuoy, TrendingUp, ArrowLeft, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";

const Support = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="fixed top-0 inset-x-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-3 sm:px-4 h-14 sm:h-16">
          <button onClick={() => navigate("/")} className="flex items-center gap-2" aria-label="Back to home">
            <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            <span className="text-base sm:text-lg font-bold tracking-tight">
              Equity<span className="text-primary">IQ</span>
            </span>
          </button>
          <div className="flex items-center gap-1 sm:gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1.5">
              <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Home</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/faq")} className="hidden sm:inline-flex">
              FAQ
            </Button>
            {user ? (
              <Button onClick={() => navigate("/dashboard")} size="sm" className="text-xs sm:text-sm">
                Dashboard <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button size="sm" onClick={() => navigate("/auth")} className="text-xs sm:text-sm">
                Get Started <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </nav>

      <section className="pt-24 sm:pt-32 pb-14 sm:pb-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="secondary" className="mb-3">
              <LifeBuoy className="h-3 w-3 mr-1 text-primary" /> Support
            </Badge>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">Need a hand?</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-3 max-w-xl mx-auto px-2">
              Questions about features, pricing, billing, or anything else? Reach out and we'll get back to you as soon
              as possible.
            </p>
            <p className="mt-6 text-lg sm:text-xl font-semibold text-primary break-all">support@equityiq.in</p>
            <p className="text-xs text-muted-foreground mt-4">
              Typical response time: within 24 hours on business days.
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Support;
