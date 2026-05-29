import { useState, useEffect } from "react";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Star, Loader2, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";

const ProfileReviews = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewHover, setReviewHover] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [reviewDesignation, setReviewDesignation] = useState("");
  const [existingReview, setExistingReview] = useState<any>(null);
  const [savingReview, setSavingReview] = useState(false);

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    (async () => {
      const { data: prof } = await supabase.from("profiles").select("display_name").eq("user_id", user.id).single();
      if (prof?.display_name) setDisplayName(prof.display_name);
      const { data: review } = await supabase.from("app_reviews").select("*").eq("user_id", user.id).maybeSingle();
      if (review) {
        setExistingReview(review);
        setReviewRating(review.rating);
        setReviewText(review.review);
        setReviewDesignation(review.designation || "");
      }
      setLoading(false);
    })();
  }, [user, navigate]);

  const handleSaveReview = async () => {
    if (!user || reviewRating === 0 || !reviewText.trim()) return toast.error("Please provide a rating and review.");
    setSavingReview(true);
    const reviewData = {
      user_id: user.id,
      display_name: displayName.trim() || user.email?.split("@")[0] || "User",
      designation: reviewDesignation.trim() || null,
      rating: reviewRating,
      review: reviewText.trim(),
    };
    const { error } = existingReview
      ? await supabase.from("app_reviews").update(reviewData).eq("id", existingReview.id)
      : await supabase.from("app_reviews").insert(reviewData);
    setSavingReview(false);
    if (error) return toast.error("Failed to save review.");
    toast.success(existingReview ? "Review updated!" : "Review submitted! Thank you!");
    setExistingReview({ ...existingReview, ...reviewData });
  };

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-background pb-bottom-nav">
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8">
        <Button variant="ghost" onClick={() => navigate("/profile")} className="mb-4 sm:mb-6 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Profile
        </Button>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <div className="mb-5">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">Your Review</h1>
            <p className="text-muted-foreground text-sm">Share your experience with EquityIQ — approved reviews appear on the landing page</p>
          </div>
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-foreground text-base">
                <div className="p-1.5 rounded-lg bg-primary/10"><MessageSquare className="h-4 w-4 text-primary" /></div>
                {existingReview ? "Update Your Review" : "Leave a Review"}
              </CardTitle>
              <CardDescription className="text-xs">Help other investors discover EquityIQ</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Rating</Label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button key={star} type="button" className="transition-transform hover:scale-125 active:scale-95" onMouseEnter={() => setReviewHover(star)} onMouseLeave={() => setReviewHover(0)} onClick={() => setReviewRating(star)}>
                      <Star className={`h-7 w-7 transition-colors ${star <= (reviewHover || reviewRating) ? "fill-primary text-primary" : "text-muted-foreground/40"}`} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="review-designation" className="text-xs">Designation (optional)</Label>
                <Input id="review-designation" value={reviewDesignation} onChange={(e) => setReviewDesignation(e.target.value)} placeholder="e.g. Swing Trader, Long-term Investor" maxLength={60} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="review-text" className="text-xs">Your Review</Label>
                <Textarea id="review-text" value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder="Tell us what you love about EquityIQ..." rows={4} maxLength={500} />
              </div>
              <Button onClick={handleSaveReview} disabled={savingReview || reviewRating === 0 || !reviewText.trim()} className="w-full active:scale-[0.98] transition-all" variant="secondary">
                {savingReview ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Star className="mr-2 h-4 w-4" />}
                {existingReview ? "Update Review" : "Submit Review"}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
      <BottomNav />
    </div>
  );
};

export default ProfileReviews;
