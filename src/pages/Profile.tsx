import { useState, useEffect } from "react";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminRole } from "@/hooks/useAdminRole";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save, User, Mail, Bell, Loader2, Lock, Shield, Star, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";

const Profile = () => {
  const { user, profile, signOut } = useAuth();
  const { isAdmin } = useAdminRole();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [emailOptIn, setEmailOptIn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  // Review state
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewHover, setReviewHover] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [reviewDesignation, setReviewDesignation] = useState("");
  const [existingReview, setExistingReview] = useState<any>(null);
  const [savingReview, setSavingReview] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchProfileData();
  }, [user]);

  const fetchProfileData = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("display_name, email_opt_in")
      .eq("user_id", user.id)
      .single();
    if (data) {
      setDisplayName(data.display_name || "");
      setEmailOptIn(data.email_opt_in ?? false);
    }
    // Fetch existing review
    const { data: review } = await supabase
      .from("app_reviews")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (review) {
      setExistingReview(review);
      setReviewRating(review.rating);
      setReviewText(review.review);
      setReviewDesignation(review.designation || "");
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName.trim(), email_opt_in: emailOptIn })
      .eq("user_id", user.id);

    // If user re-enabled email opt-in, also remove from suppression list
    if (!error && emailOptIn) {
      await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { action: "resubscribe", user_id: user.id },
      });
    }

    setSaving(false);
    if (error) {
      toast.error("Failed to save profile");
    } else {
      toast.success("Profile updated successfully");
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error("Please fill in both password fields");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) {
      toast.error(error.message || "Failed to change password");
    } else {
      toast.success("Password changed successfully");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const handleSaveReview = async () => {
    if (!user || reviewRating === 0 || !reviewText.trim()) {
      toast.error("Please provide a rating and review.");
      return;
    }
    setSavingReview(true);
    const reviewData = {
      user_id: user.id,
      display_name: displayName.trim() || user.email?.split("@")[0] || "User",
      designation: reviewDesignation.trim() || null,
      rating: reviewRating,
      review: reviewText.trim(),
    };

    let error;
    if (existingReview) {
      ({ error } = await supabase.from("app_reviews").update(reviewData).eq("id", existingReview.id));
    } else {
      ({ error } = await supabase.from("app_reviews").insert(reviewData));
    }
    setSavingReview(false);
    if (error) {
      toast.error("Failed to save review.");
      return;
    }
    toast.success(existingReview ? "Review updated!" : "Review submitted! Thank you!");
    setExistingReview({ ...existingReview, ...reviewData });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-bottom-nav">
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard")}
          className="mb-4 sm:mb-6 text-muted-foreground hover:text-foreground active:scale-95 transition-all"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-5"
        >
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">Profile Settings</h1>
            <p className="text-muted-foreground text-sm">Manage your personal information and preferences</p>
          </div>

          {/* Personal Information */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <Card className="border-border shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-foreground text-base">
                  <div className="p-1.5 rounded-lg bg-primary/10"><User className="h-4 w-4 text-primary" /></div>
                  Personal Information
                </CardTitle>
                <CardDescription className="text-xs">Update your display name and view your account details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-muted-foreground text-xs">Email</Label>
                  <Input id="email" value={user?.email || ""} disabled className="bg-muted text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="displayName" className="text-xs">Display Name</Label>
                  <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Enter your display name" maxLength={100} />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Email Preferences */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="border-border shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-foreground text-base">
                  <div className="p-1.5 rounded-lg bg-primary/10"><Bell className="h-4 w-4 text-primary" /></div>
                  Email Preferences
                </CardTitle>
                <CardDescription className="text-xs">Choose which emails you'd like to receive</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between rounded-lg border border-border p-3 sm:p-4 hover:bg-muted/30 transition-colors">
                  <div className="space-y-0.5">
                    <Label htmlFor="email-opt-in" className="text-sm font-medium">Email Updates</Label>
                    <p className="text-xs text-muted-foreground">Receive price alerts, watchlist notifications, and product updates</p>
                  </div>
                  <Switch id="email-opt-in" checked={emailOptIn} onCheckedChange={setEmailOptIn} />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Change Password */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card className="border-border shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-foreground text-base">
                  <div className="p-1.5 rounded-lg bg-primary/10"><Lock className="h-4 w-4 text-primary" /></div>
                  Change Password
                </CardTitle>
                <CardDescription className="text-xs">Update your account password</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword" className="text-xs">New Password</Label>
                  <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter new password" minLength={6} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-xs">Confirm New Password</Label>
                  <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password" minLength={6} />
                </div>
                <Button onClick={handleChangePassword} disabled={changingPassword || !newPassword || !confirmPassword} variant="secondary" className="w-full active:scale-[0.98] transition-all">
                  {changingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
                  Change Password
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Review Section */}
          {!isAdmin && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card className="border-border shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-foreground text-base">
                    <div className="p-1.5 rounded-lg bg-primary/10"><MessageSquare className="h-4 w-4 text-primary" /></div>
                    {existingReview ? "Your Review" : "Leave a Review"}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {existingReview ? "Update your review — it's displayed on our landing page" : "Share your experience to help other investors discover EquityLens"}
                  </CardDescription>
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
                    <Label htmlFor="profile-review-designation" className="text-xs">Designation (optional)</Label>
                    <Input id="profile-review-designation" value={reviewDesignation} onChange={(e) => setReviewDesignation(e.target.value)} placeholder="e.g. Swing Trader, Long-term Investor" maxLength={60} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="profile-review-text" className="text-xs">Your Review</Label>
                    <Textarea id="profile-review-text" value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder="Tell us what you love about EquityLens..." rows={3} maxLength={500} />
                  </div>
                  <Button onClick={handleSaveReview} disabled={savingReview || reviewRating === 0 || !reviewText.trim()} className="w-full active:scale-[0.98] transition-all" variant="secondary">
                    {savingReview ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Star className="mr-2 h-4 w-4" />}
                    {existingReview ? "Update Review" : "Submit Review"}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {isAdmin && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card className="border-primary/30 bg-primary/5 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-foreground text-base">
                    <div className="p-1.5 rounded-lg bg-primary/15"><Shield className="h-4 w-4 text-primary" /></div>
                    Admin Panel
                  </CardTitle>
                  <CardDescription className="text-xs">You have administrator access</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={() => navigate("/admin")} className="w-full active:scale-[0.98] transition-all">
                    <Shield className="mr-2 h-4 w-4" /> View & Manage All Users
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <Card className="border-border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-foreground text-base">
                  <div className="p-1.5 rounded-lg bg-primary/10"><Mail className="h-4 w-4 text-primary" /></div>
                  Account
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Email Verified</p>
                    <p className="text-xs text-muted-foreground">
                      {user?.email_confirmed_at ? "Your email is verified" : "Please verify your email"}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    user?.email_confirmed_at
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                  }`}>
                    {user?.email_confirmed_at ? "Verified" : "Pending"}
                  </span>
                </div>
                <div className="pt-2 border-t border-border">
                  <Button variant="destructive" size="sm" onClick={signOut} className="active:scale-95 transition-all">
                    Sign Out
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Button onClick={handleSave} disabled={saving} className="w-full h-11 active:scale-[0.98] transition-all" size="lg">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Changes
            </Button>
          </motion.div>
        </motion.div>
      </div>
      <BottomNav />
    </div>
  );
};

export default Profile;
