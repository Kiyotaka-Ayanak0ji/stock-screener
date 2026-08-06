import { useState, useEffect, useRef, useCallback } from "react";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useSubscription } from "@/hooks/useSubscription";
import { useStocks } from "@/contexts/StockContext";
import { supabase } from "@/integrations/supabase/client";
import { requestWalkthroughReplay } from "@/components/OnboardingWalkthrough";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Check, User, Mail, Bell, Loader2, Lock, Shield, Star, MessageSquare, Zap, CreditCard, ChevronRight, Link2, Unlink } from "lucide-react";
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
  const [monthlyReportOptIn, setMonthlyReportOptIn] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  // Autosave bookkeeping: the last values persisted to the server, and the
  // pending 2s debounce timer for the current edit.
  const lastSavedRef = useRef<{ displayName: string; emailOptIn: boolean; monthlyReportOptIn: boolean } | null>(null);
  const saveTimerRef = useRef<number | null>(null);
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
      .select("display_name, email_opt_in, monthly_report_opt_in")
      .eq("user_id", user.id)
      .single();
    if (data) {
      setDisplayName(data.display_name || "");
      setEmailOptIn(data.email_opt_in ?? false);
      setMonthlyReportOptIn(data.monthly_report_opt_in ?? true);
      lastSavedRef.current = {
        displayName: data.display_name || "",
        emailOptIn: data.email_opt_in ?? false,
        monthlyReportOptIn: data.monthly_report_opt_in ?? true,
      };
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

  const persistProfile = useCallback(
    async (name: string, optIn: boolean, monthlyOptIn: boolean) => {
      if (!user) return;
      setSaving(true);
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: name.trim(), email_opt_in: optIn, monthly_report_opt_in: monthlyOptIn })
        .eq("user_id", user.id);

      // Re-enabling email updates also clears the address from suppression.
      if (!error && optIn) {
        await supabase.functions.invoke("handle-email-unsubscribe", {
          body: { action: "resubscribe", user_id: user.id },
        });
      }

      setSaving(false);
      if (error) {
        toast.error("Could not save changes");
      } else {
        lastSavedRef.current = { displayName: name, emailOptIn: optIn, monthlyReportOptIn: monthlyOptIn };
        setSavedAt(Date.now());
      }
    },
    [user],
  );

  // Autosave: persist 2 seconds after the last edit, skipping no-op writes.
  useEffect(() => {
    if (loading || !user) return;
    const last = lastSavedRef.current;
    if (
      last &&
      last.displayName === displayName &&
      last.emailOptIn === emailOptIn &&
      last.monthlyReportOptIn === monthlyReportOptIn
    )
      return;

    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      void persistProfile(displayName, emailOptIn, monthlyReportOptIn);
    }, 2000);

    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [displayName, emailOptIn, monthlyReportOptIn, loading, user, persistProfile]);

  // Password change moved to /profile/password

  const handleToggleAutoRefresh = async (enabled: boolean) => {
    if (!isPremiumPlus) {
      toast.error("Auto-refresh is a Premium Plus feature", {
        description: "Upgrade to enable it.",
        action: { label: "Upgrade", onClick: () => navigate("/subscribe") },
      });
      return;
    }
    setSavingAutoRefresh(true);
    try {
      await setAutoRefreshOnLoad(enabled);
      toast.success(enabled ? "Auto-refresh enabled" : "Auto-refresh disabled");
    } catch {
      toast.error("Could not update this setting");
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
    <div className="min-h-screen bg-background pb-bottom-nav">
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard")}
          className="mb-4 sm:mb-6 text-muted-foreground hover:text-foreground active:scale-95 transition-all"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to dashboard
        </Button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-5"
        >
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">Profile</h1>
              <p className="text-muted-foreground text-sm">Changes save automatically.</p>
            </div>
            <div aria-live="polite" className="text-xs text-muted-foreground shrink-0 pb-1 min-h-[1rem]">
              {saving ? (
                <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" />Saving</span>
              ) : savedAt ? (
                <span className="inline-flex items-center gap-1.5 text-primary"><Check className="h-3 w-3" />Saved</span>
              ) : null}
            </div>
          </div>

          {/* Personal Information */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <Card className="border-border shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-foreground text-base">
                  <div className="p-1.5 rounded-lg bg-primary/10"><User className="h-4 w-4 text-primary" /></div>
                  Account details
                </CardTitle>
                <CardDescription className="text-xs">Your display name is used across the app.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-muted-foreground text-xs">Email</Label>
                  <Input id="email" value={user?.email || ""} disabled className="bg-muted text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="displayName" className="text-xs">Display name</Label>
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
                  Email
                </CardTitle>
                <CardDescription className="text-xs">Controls all digests and alert emails.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between rounded-lg border border-border p-3 sm:p-4 hover:bg-muted/30 transition-colors">
                  <div className="space-y-0.5">
                    <Label htmlFor="email-opt-in" className="text-sm font-medium">Email updates</Label>
                    <p className="text-xs text-muted-foreground">Price alerts, watchlist digests and product updates.</p>
                  </div>
                  <Switch id="email-opt-in" checked={emailOptIn} onCheckedChange={setEmailOptIn} />
                </div>

                <div className="mt-3 flex items-center justify-between rounded-lg border border-border p-3 sm:p-4 hover:bg-muted/30 transition-colors">
                  <div className="space-y-0.5">
                    <Label htmlFor="monthly-report-opt-in" className="text-sm font-medium">
                      Monthly activity report
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      One email at the start of each month with your watchlists, favourites and alerts.
                    </p>
                  </div>
                  <Switch
                    id="monthly-report-opt-in"
                    checked={emailOptIn && monthlyReportOptIn}
                    disabled={!emailOptIn}
                    onCheckedChange={setMonthlyReportOptIn}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Live Data, Premium Plus auto-refresh-on-load */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
            <Card className={`shadow-sm hover:shadow-md transition-shadow ${isPremiumPlus ? "border-primary/30" : "border-border"}`}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-foreground text-base">
                  <div className="p-1.5 rounded-lg bg-primary/10"><Zap className="h-4 w-4 text-primary" /></div>
                  Live data
                  <span className="ml-auto rounded-full border border-primary/40 px-2 py-0.5 text-[10px] font-medium text-primary">
                    Premium Plus
                  </span>
                </CardTitle>
                <CardDescription className="text-xs">
                  {isPremiumPlus
                    ? "Fetches a fresh quote for every stock when the dashboard loads or cached prices are read."
                    : "Available on Premium Plus. Fetches fresh quotes whenever the dashboard loads."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between rounded-lg border border-border p-3 sm:p-4 hover:bg-muted/30 transition-colors">
                  <div className="space-y-0.5 pr-3">
                    <Label htmlFor="auto-refresh" className="text-sm font-medium">Auto refresh on load</Label>
                    <p className="text-xs text-muted-foreground">
                      Runs on every page load and watchlist switch.
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
                    Upgrade to Premium Plus
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
                  Sign-in methods
                </CardTitle>
                <CardDescription className="text-xs">
                  Link Google to sign in with either your password or Google. Accounts with the same verified email link automatically.
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
                    Google is your only sign-in method. Set a password before unlinking.
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Quick links, subscription, password, reviews live on dedicated pages */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card className="border-border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-foreground text-base">Manage</CardTitle>
                
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
                    <p className="text-sm font-medium text-foreground">Subscription</p>
                    <p className="text-xs text-muted-foreground">Current plan and billing dates.</p>
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
                    <p className="text-sm font-medium text-foreground">Password</p>
                    <p className="text-xs text-muted-foreground">Change your account password.</p>
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
                        Review <Star className="h-3 w-3 text-primary" />
                      </p>
                      <p className="text-xs text-muted-foreground">Leave or update your review.</p>
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
                    Administration
                  </CardTitle>
                  <CardDescription className="text-xs">You have administrator access.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={() => navigate("/admin")} className="w-full active:scale-[0.98] transition-all">
                    <Shield className="mr-2 h-4 w-4" /> Manage users
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
                    <p className="text-sm font-medium text-foreground">Email verification</p>
                    <p className="text-xs text-muted-foreground">
                      {user?.email_confirmed_at ? "Your email address is confirmed." : "Confirm your email to unlock all features."}
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
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div className="pr-3">
                    <p className="text-sm font-medium text-foreground">Guided tour</p>
                    <p className="text-xs text-muted-foreground">Replay the walkthrough of search, filters, watchlists and favourites.</p>
                  </div>
                  <Button
                    variant="outline"
                    className="shrink-0 active:scale-95 transition-all h-10"
                    onClick={() => {
                      requestWalkthroughReplay(user?.id);
                      toast.success("Starting the tour", { description: "Opening your dashboard." });
                      navigate("/dashboard");
                    }}
                  >
                    Replay
                  </Button>
                </div>
                <div className="pt-2 border-t border-border">
                  <Button variant="destructive" onClick={signOut} className="active:scale-95 transition-all h-10">
                    Sign out
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

        </motion.div>
      </div>

      <BottomNav />
    </div>
  );
};

export default Profile;
