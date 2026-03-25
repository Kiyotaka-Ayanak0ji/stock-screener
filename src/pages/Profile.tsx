import { useState, useEffect } from "react";
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
  const [changingPassword, setChangingPassword] = useState(false);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard")}
          className="mb-6 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-3xl font-bold text-foreground mb-2">Profile Settings</h1>
          <p className="text-muted-foreground mb-8">Manage your personal information and preferences</p>

          {/* Personal Information */}
          <Card className="mb-6 border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <User className="h-5 w-5 text-primary" />
                Personal Information
              </CardTitle>
              <CardDescription>Update your display name and view your account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-muted-foreground">Email</Label>
                <Input
                  id="email"
                  value={user?.email || ""}
                  disabled
                  className="bg-muted text-muted-foreground"
                />
                <p className="text-xs text-muted-foreground">Email cannot be changed</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter your display name"
                  maxLength={100}
                />
              </div>
            </CardContent>
          </Card>

          {/* Email Preferences */}
          <Card className="mb-6 border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Bell className="h-5 w-5 text-primary" />
                Email Preferences
              </CardTitle>
              <CardDescription>Choose which emails you'd like to receive</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="email-opt-in" className="text-sm font-medium">Email Updates</Label>
                  <p className="text-xs text-muted-foreground">
                    Receive price alerts, watchlist notifications, and product updates
                  </p>
                </div>
                <Switch
                  id="email-opt-in"
                  checked={emailOptIn}
                  onCheckedChange={setEmailOptIn}
                />
              </div>
            </CardContent>
          </Card>

          {/* Change Password */}
          <Card className="mb-6 border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Lock className="h-5 w-5 text-primary" />
                Change Password
              </CardTitle>
              <CardDescription>Update your account password</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  minLength={6}
                />
              </div>
              <Button
                onClick={handleChangePassword}
                disabled={changingPassword || !newPassword || !confirmPassword}
                variant="secondary"
                className="w-full"
              >
                {changingPassword ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Lock className="mr-2 h-4 w-4" />
                )}
                Change Password
              </Button>
            </CardContent>
          </Card>

          {/* Admin Panel - only visible to admins */}
          {isAdmin && (
            <Card className="mb-6 border-primary/30 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <Shield className="h-5 w-5 text-primary" />
                  Admin Panel
                </CardTitle>
                <CardDescription>You have administrator access</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => navigate("/admin")} className="w-full">
                  <Shield className="mr-2 h-4 w-4" />
                  View & Manage All Users
                </Button>
              </CardContent>
            </Card>
          )}

          <Card className="mb-8 border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Mail className="h-5 w-5 text-primary" />
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
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  user?.email_confirmed_at
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                }`}>
                  {user?.email_confirmed_at ? "Verified" : "Pending"}
                </span>
              </div>
              <div className="pt-2 border-t border-border">
                <Button variant="destructive" size="sm" onClick={signOut}>
                  Sign Out
                </Button>
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleSave} disabled={saving} className="w-full" size="lg">
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Changes
          </Button>
        </motion.div>
      </div>
    </div>
  );
};

export default Profile;
