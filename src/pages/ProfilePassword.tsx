import { useState, useEffect } from "react";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Lock, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";

const ProfilePassword = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changing, setChanging] = useState(false);

  useEffect(() => { if (!user) navigate("/auth"); }, [user, navigate]);

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) return toast.error("Please fill in both password fields");
    if (newPassword.length < 6) return toast.error("Password must be at least 6 characters");
    if (newPassword !== confirmPassword) return toast.error("Passwords do not match");
    setChanging(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChanging(false);
    if (error) return toast.error(error.message || "Failed to change password");
    toast.success("Password changed successfully");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="min-h-screen bg-background pb-bottom-nav">
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8">
        <Button variant="ghost" onClick={() => navigate("/profile")} className="mb-4 sm:mb-6 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Profile
        </Button>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <div className="mb-5">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">Change Password</h1>
            <p className="text-muted-foreground text-sm">Update your account password</p>
          </div>
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-foreground text-base">
                <div className="p-1.5 rounded-lg bg-primary/10"><Lock className="h-4 w-4 text-primary" /></div>
                New Password
              </CardTitle>
              <CardDescription className="text-xs">Choose a strong password — at least 6 characters</CardDescription>
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
              <Button onClick={handleChangePassword} disabled={changing || !newPassword || !confirmPassword} variant="secondary" className="w-full active:scale-[0.98] transition-all">
                {changing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
                Change Password
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
      <BottomNav />
    </div>
  );
};

export default ProfilePassword;
