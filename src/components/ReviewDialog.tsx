import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminRole } from "@/hooks/useAdminRole";
import { toast } from "sonner";

const ReviewDialog = () => {
  const { user } = useAuth();
  const { isAdmin } = useAdminRole();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [review, setReview] = useState("");
  const [designation, setDesignation] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);

  useEffect(() => {
    if (!user || isAdmin) return;

    const checkExisting = async () => {
      const { data } = await supabase
        .from("app_reviews")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        setAlreadyReviewed(true);
        return;
      }

      // Show dialog after 5 seconds on dashboard for users who haven't reviewed
      const dismissed = sessionStorage.getItem("review_dialog_dismissed");
      if (!dismissed) {
        const timer = setTimeout(() => setOpen(true), 5000);
        return () => clearTimeout(timer);
      }
    };

    // Fetch profile for default display name
    const fetchProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data?.display_name) setDisplayName(data.display_name);
    };

    checkExisting();
    fetchProfile();
  }, [user, isAdmin]);

  const handleClose = () => {
    setOpen(false);
    sessionStorage.setItem("review_dialog_dismissed", "true");
  };

  const handleSubmit = async () => {
    if (!user || rating === 0 || !review.trim()) {
      toast.error("Please provide a rating and review.");
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("app_reviews").insert({
      user_id: user.id,
      display_name: displayName.trim() || user.email?.split("@")[0] || "User",
      designation: designation.trim() || null,
      rating,
      review: review.trim(),
    });

    setSubmitting(false);
    if (error) {
      toast.error("Failed to submit review. Please try again.");
      return;
    }

    toast.success("Thank you for your review!");
    setAlreadyReviewed(true);
    setOpen(false);
  };

  if (!user || isAdmin || alreadyReviewed) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>How's your experience?</DialogTitle>
          <DialogDescription>
            We'd love to hear your feedback! Your review helps other investors discover EquityLens.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Star Rating */}
          <div className="space-y-1.5">
            <Label>Rating</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className="transition-transform hover:scale-110"
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                >
                  <Star
                    className={`h-7 w-7 transition-colors ${
                      star <= (hoverRating || rating)
                        ? "fill-primary text-primary"
                        : "text-muted-foreground/40"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Display Name */}
          <div className="space-y-1.5">
            <Label htmlFor="review-name">Your Name</Label>
            <Input
              id="review-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="How should we display your name?"
              maxLength={50}
            />
          </div>

          {/* Designation */}
          <div className="space-y-1.5">
            <Label htmlFor="review-designation">Designation (optional)</Label>
            <Input
              id="review-designation"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              placeholder="e.g. Swing Trader, Long-term Investor"
              maxLength={60}
            />
          </div>

          {/* Review Text */}
          <div className="space-y-1.5">
            <Label htmlFor="review-text">Your Review</Label>
            <Textarea
              id="review-text"
              value={review}
              onChange={(e) => setReview(e.target.value)}
              placeholder="Tell us what you love about EquityLens..."
              rows={3}
              maxLength={500}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={handleClose}>Maybe Later</Button>
          <Button onClick={handleSubmit} disabled={submitting || rating === 0 || !review.trim()}>
            {submitting ? "Submitting..." : "Submit Review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReviewDialog;
