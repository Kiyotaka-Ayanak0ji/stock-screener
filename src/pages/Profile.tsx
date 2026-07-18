import { useState, useEffect } from "react";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useSubscription } from "@/hooks/useSubscription";
import { useStocks } from "@/contexts/StockContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save, User, Mail, Bell, Loader2, Lock, Shield, Star, MessageSquare, Zap, Sparkles, CreditCard, ChevronRight, Link2, Unlink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";

const Profile = () => {
  const { user, profile, signOut } = useAuth();
  const { isAdmin } = useAdminRole();
  const { isPremiumPlus } = useSubscription();
  const { autoRefreshOnLoad, setAutoRefreshOnLoad } = useStocks();
  const [savingAutoRefresh, setSavingAutoRefresh] = useState(false);
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [emailOptIn, setEmailOptIn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [identities, setIdentities] = useState<Array<{ id: string; identity_id?: string; provider: string; identity_data?: Record<string, unknown> }>>([]);
  const [isLinkingGoogle, setIsLinkingGoogle] = useState(false);
  const [isUnlinkingGoogle, setIsUnlinkingGoogle] = useState(false);
  // Password change & reviews are now on dedicated subpages —
  // /profile/password and /profile/reviews. Subscription mgmt lives at
  // /profile/subscription. This page only handles core profile/preferences.

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchProfileData();
  }, [user]);

  // Handle post-redirect link result (OAuth flow returns to /profile)
  useEffect(() => {
    const pending = sessionStorage.getItem("linking_google_pending");
    if (!pending) return;

    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const search = new URLSearchParams(window.location.search);
    const err = hash.get("error_description") || hash.get("error") || search.get("error_description") || search.get("error");

    sessionStorage.removeItem("linking_google_pending");

    if (err) {
      toast.error("Failed to link Google account", { description: decodeURIComponent(err.replace(/\+/g, " ")) });
      // Rollback: clear stray hash so a refresh doesn't repeat the toast
      if (window.location.hash) window.history.replaceState(null, "", window.location.pathname);
      return;
    }

    // Verify link actually succeeded by re-reading identities
    (async () => {
      const { data } = await supabase.auth.getUserIdentities();
      const list = (data?.identities ?? []) as any[];
      const prevCount = Number(pending) || 0;
      if (list.some((i) => i.provider === "google") && list.length > prevCount) {
        toast.success("Google account linked", { description: "You can now sign in with Google." });
      } else if (list.some((i) => i.provider === "google")) {
        toast.success("Google account already linked");
      } else {
        toast.error("Google linking did not complete", { description: "Please try again." });
      }
      setIdentities(list);
    })();
  }, []);

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
    setLoading(false);
    loadIdentities();
  };

  const loadIdentities = async () => {
    const { data, error } = await supabase.auth.getUserIdentities();
    if (!error && data?.identities) {
      setIdentities(data.identities as any);
    }
  };

  const handleLinkGoogle = async () => {
    if (isLinkingGoogle || isUnlinkingGoogle) return;
    setIsLinkingGoogle(true);
    // Snapshot current identity count so the post-redirect handler can verify
    // a new identity was actually attached, and can roll back UI state cleanly.
    sessionStorage.setItem("linking_google_pending", String(identities.length));

    const { data, error } = await supabase.auth.linkIdentity({
      provider: "google",
      options: { redirectTo: window.location.origin + "/profile" },
    });

    if (error) {
      // Rollback: drop pending marker so we don't show a bogus toast next mount
      sessionStorage.removeItem("linking_google_pending");
      setIsLinkingGoogle(false);
      const msg = error.message?.toLowerCase() ?? "";
      if (msg.includes("manual linking") || msg.includes("not enabled")) {
        toast.error("Failed to link Google account", {
          description: "Manual identity linking is not enabled for this project.",
        });
      } else if (msg.includes("already") || msg.includes("exists")) {
        toast.error("Failed to link Google account", {
          description: "This Google account is already linked to another user.",
        });
      } else {
        toast.error("Failed to link Google account", { description: error.message });
      }
      return;
    }

    // If no redirect URL was returned, the link resolved inline — refresh + toast now.
    if (!data?.url) {
      sessionStorage.removeItem("linking_google_pending");
      await loadIdentities();
      setIsLinkingGoogle(false);
      toast.success("Google account linked");
    }
    // Otherwise the browser is about to navigate to the provider; the
    // post-redirect useEffect above will fire the success/error toast.
  };

  const handleUnlinkGoogle = async () => {
    if (isLinkingGoogle || isUnlinkingGoogle) return;
    const google = identities.find((i) => i.provider === "google");
    if (!google) return;
    if (identities.length <= 1) {
      toast.error("Failed to unlink Google account", {
        description: "This is your only sign-in method. Set a password first.",
      });
      return;
    }
    setIsUnlinkingGoogle(true);

    // Optimistic update so the UI feels instant; rollback on failure.
    const previous = identities;
    setIdentities((prev) => prev.filter((i) => i.provider !== "google"));

    const { error } = await supabase.auth.unlinkIdentity(google as any);

    if (error) {
      // Rollback optimistic removal and clear loading before showing the error.
      setIdentities(previous);
      setIsUnlinkingGoogle(false);
      toast.error("Failed to unlink Google account", { description: error.message });
      return;
    }

    toast.success("Google account unlinked", { description: "You can sign in again anytime by re-linking." });
    // Re-sync from server to stay authoritative, keeping the button disabled until we're done.
    await loadIdentities();
    setIsUnlinkingGoogle(false);
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

  // Password change moved to /profile/password

  const handleToggleAutoRefresh = async (enabled: boolean) => {
    if (!isPremiumPlus) {
      toast.error("Auto-refresh on reload is a Premium Plus feature", {
        description: "Upgrade to Premium Plus to unlock this setting.",
        action: { label: "Upgrade", onClick: () => navigate("/subscribe") },
      });
      return;
    }
    setSavingAutoRefresh(true);
    try {
      await setAutoRefreshOnLoad(enabled);
      toast.success(enabled ? "Auto-refresh enabled" : "Auto-refresh disabled");
    } catch {
      toast.error("Failed to update preference");
    } finally {
      setSavingAutoRefresh(false);
    }
  };

  // Review form moved to /profile/reviews

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-bottom-nav-with-action sm:pb-bottom-nav">
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

          {/* Live Data — Premium Plus auto-refresh-on-load */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
            <Card className={`shadow-sm hover:shadow-md transition-shadow ${isPremiumPlus ? "border-primary/30 bg-gradient-to-br from-primary/5 to-orange-500/5" : "border-border"}`}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-foreground text-base">
                  <div className="p-1.5 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20">
                    <Zap className="h-4 w-4 text-orange-500" />
                  </div>
                  Live Data
                  <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                    <Sparkles className="h-3 w-3" /> Premium Plus
                  </span>
                </CardTitle>
                <CardDescription className="text-xs">
                  {isPremiumPlus
                    ? "Automatically pull a fresh quote for every stock the moment the dashboard loads or cached prices are re-read from memory — on top of the normal background polling."
                    : "Upgrade to Premium Plus to auto-refresh every stock price the moment the dashboard reloads or pulls from cache."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between rounded-lg border border-border p-3 sm:p-4 hover:bg-muted/30 transition-colors">
                  <div className="space-y-0.5 pr-3">
                    <Label htmlFor="auto-refresh" className="text-sm font-medium">Auto-refresh on reload</Label>
                    <p className="text-xs text-muted-foreground">
                      Forces an immediate live fetch on every page load and watchlist switch.
                    </p>
                  </div>
                  <Switch
                    id="auto-refresh"
                    checked={isPremiumPlus && autoRefreshOnLoad}
                    disabled={!isPremiumPlus || savingAutoRefresh}
                    onCheckedChange={handleToggleAutoRefresh}
                  />
                </div>
                {!isPremiumPlus && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-3 active:scale-[0.98] transition-all"
                    onClick={() => navigate("/subscribe")}
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-1.5 text-orange-500" />
                    Unlock with Premium Plus
                  </Button>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Linked sign-in methods */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
            <Card className="border-border shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-foreground text-base">
                  <div className="p-1.5 rounded-lg bg-primary/10"><Link2 className="h-4 w-4 text-primary" /></div>
                  Linked Accounts
                </CardTitle>
                <CardDescription className="text-xs">
                  Link a Google account to sign in either with your password or with Google. Accounts sharing a verified email are linked automatically on first Google sign-in.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {(() => {
                  const google = identities.find((i) => i.provider === "google");
                  const googleEmail = (google?.identity_data as any)?.email as string | undefined;
                  return (
                    <div className="flex items-center justify-between rounded-lg border border-border p-3 sm:p-4 hover:bg-muted/30 transition-colors gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0 0 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.1A6.63 6.63 0 0 1 5.5 12c0-.73.12-1.44.34-2.1V7.06H2.18A10.99 10.99 0 0 0 1 12c0 1.78.43 3.46 1.18 4.94l3.66-2.84z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
                        </svg>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">Google</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {google ? (googleEmail ? `Connected · ${googleEmail}` : "Connected") : "Not connected"}
                          </p>
                        </div>
                      </div>
                      {google ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleUnlinkGoogle}
                          disabled={isUnlinkingGoogle || isLinkingGoogle || identities.length <= 1}
                          aria-label={isUnlinkingGoogle ? "Unlinking Google account" : "Unlink Google account"}
                          className="shrink-0 min-w-[100px]"
                        >
                          {isUnlinkingGoogle ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                              Unlinking...
                            </>
                          ) : (
                            <><Unlink className="h-3.5 w-3.5 mr-1.5" />Unlink</>
                          )}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleLinkGoogle}
                          disabled={isLinkingGoogle || isUnlinkingGoogle}
                          aria-label={isLinkingGoogle ? "Linking Google account" : "Link Google account"}
                          className="shrink-0 min-w-[100px]"
                        >
                          {isLinkingGoogle ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                              Linking...
                            </>
                          ) : (
                            <><Link2 className="h-3.5 w-3.5 mr-1.5" />Link Google</>
                          )}
                        </Button>
                      )}
                    </div>
                  );
                })()}
                {identities.length <= 1 && identities.some((i) => i.provider === "google") && (
                  <p className="text-[11px] text-muted-foreground px-1">
                    Google is currently your only sign-in method. Set a password first before unlinking.
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Quick links — subscription, password, reviews live on dedicated pages */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card className="border-border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-foreground text-base">Account & Activity</CardTitle>
                <CardDescription className="text-xs">Manage subscription, security and reviews on their own pages</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <button
                  onClick={() => navigate("/profile/subscription")}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/40 hover:border-primary/40 transition-all text-left group active:scale-[0.99]"
                >
                  <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-colors">
                    <CreditCard className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">My Subscription</p>
                    <p className="text-xs text-muted-foreground">View current plan, billing dates and manage your subscription</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </button>

                <button
                  onClick={() => navigate("/profile/password")}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/40 hover:border-primary/40 transition-all text-left group active:scale-[0.99]"
                >
                  <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-colors">
                    <Lock className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">Change Password</p>
                    <p className="text-xs text-muted-foreground">Update your account password</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </button>

                {!isAdmin && (
                  <button
                    onClick={() => navigate("/profile/reviews")}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/40 hover:border-primary/40 transition-all text-left group active:scale-[0.99]"
                  >
                    <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-colors">
                      <MessageSquare className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                        Your Review <Star className="h-3 w-3 text-primary" />
                      </p>
                      <p className="text-xs text-muted-foreground">Leave or update your review on EquityIQ</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </button>
                )}
              </CardContent>
            </Card>
          </motion.div>

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
                  <Button variant="destructive" onClick={signOut} className="active:scale-95 transition-all h-10">
                    Sign Out
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Desktop save button — sticky version is rendered separately for mobile */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="hidden sm:block">
            <Button onClick={handleSave} disabled={saving} className="w-full h-11 active:scale-[0.98] transition-all" size="lg">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Changes
            </Button>
          </motion.div>
        </motion.div>
      </div>

      {/* Sticky bottom save bar — mobile only */}
      <div className="sticky-bottom-action">
        <Button onClick={handleSave} disabled={saving} className="w-full h-11 active:scale-[0.98] transition-all" size="lg">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Changes
        </Button>
      </div>
      <BottomNav />
    </div>
  );
};

export default Profile;
