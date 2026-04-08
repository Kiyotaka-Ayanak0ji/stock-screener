import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2, MailX, Clock, Settings } from "lucide-react";
import { motion } from "framer-motion";

type Status = "loading" | "valid" | "already" | "invalid" | "success" | "error";

const Unsubscribe = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>("loading");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    validateToken();
  }, [token]);

  const validateToken = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token },
      });
      if (error) {
        setStatus("invalid");
        return;
      }
      if (data?.expired) {
        setStatus("expired");
      } else if (data?.error) {
        setStatus("invalid");
      } else if (data?.alreadyUnsubscribed) {
        setStatus("already");
      } else if (data?.valid) {
        setStatus("valid");
      } else {
        setStatus("invalid");
      }
    } catch {
      setStatus("invalid");
    }
  };

  const handleUnsubscribe = async () => {
    if (!token) return;
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token, confirm: true },
      });
      if (error || data?.error) {
        setStatus("error");
      } else {
        setStatus("success");
      }
    } catch {
      setStatus("error");
    }
    setProcessing(false);
  };

  const content: Record<Status, { icon: React.ReactNode; title: string; desc: string }> = {
    loading: {
      icon: <Loader2 className="h-12 w-12 animate-spin text-primary" />,
      title: "Verifying...",
      desc: "Please wait while we verify your unsubscribe request.",
    },
    valid: {
      icon: <MailX className="h-12 w-12 text-primary" />,
      title: "Unsubscribe from Email Digests",
      desc: "Click the button below to unsubscribe from email digest updates. You will still receive important alerts.",
    },
    already: {
      icon: <CheckCircle className="h-12 w-12 text-green-500" />,
      title: "Already Unsubscribed",
      desc: "You have already unsubscribed from email digests. No further action is needed.",
    },
    success: {
      icon: <CheckCircle className="h-12 w-12 text-green-500" />,
      title: "Successfully Unsubscribed",
      desc: "You have been unsubscribed from email digest updates. You will still receive important alerts. You can re-enable email updates anytime from your profile settings.",
    },
    expired: {
      icon: <Clock className="h-12 w-12 text-yellow-500" />,
      title: "Link Expired",
      desc: "This unsubscribe link has expired (valid for 10 minutes only). You can manage your email preferences from your profile settings instead.",
    },
    invalid: {
      icon: <XCircle className="h-12 w-12 text-destructive" />,
      title: "Invalid Link",
      desc: "This unsubscribe link is invalid. You can manage your email preferences from your profile settings.",
    },
    error: {
      icon: <XCircle className="h-12 w-12 text-destructive" />,
      title: "Something Went Wrong",
      desc: "We couldn't process your request. Please try again later or manage preferences from your profile.",
    },
  };

  const c = content[status];
  const showProfileButton = status === "expired" || status === "invalid" || status === "success" || status === "error";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        <Card className="border-border">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="flex justify-center">{c.icon}</div>
            <h1 className="text-2xl font-bold text-foreground">{c.title}</h1>
            <p className="text-muted-foreground text-sm">{c.desc}</p>
            {status === "valid" && (
              <Button
                onClick={handleUnsubscribe}
                disabled={processing}
                variant="destructive"
                className="mt-4"
              >
                {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm Unsubscribe
              </Button>
            )}
            {showProfileButton && (
              <Button
                onClick={() => navigate("/profile")}
                variant="outline"
                className="mt-2"
              >
                <Settings className="mr-2 h-4 w-4" />
                Go to Profile Settings
              </Button>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default Unsubscribe;
