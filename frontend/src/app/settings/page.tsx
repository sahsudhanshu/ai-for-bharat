"use client"

import React, { useState, useEffect } from 'react';
import {
  User,
  Shield,
  Bell,
  Languages,
  Globe,
  HelpCircle,
  LogOut,
  Lock,
  Eye,
  EyeOff,
  Settings as SettingsIcon,
  Smartphone,
  Save,
  Anchor,
  Scale,
  Ship,
  Download,
  Trash2,
  ChevronRight,
} from 'lucide-react';

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { getUserProfile, updateUserProfile, exportUserData, deleteUserAccount } from "@/lib/api-client";
import type { UserProfile } from "@/lib/api-client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SettingsPage() {
  const { user, logout, changePassword } = useAuth();
  const router = useRouter();

  // Profile state
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  // Password change state
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Preferences state
  const [language, setLanguage] = useState("english");
  const [notifications, setNotifications] = useState(true);
  const [offlineSync, setOfflineSync] = useState(true);
  const [units, setUnits] = useState("kg");
  const [boatType, setBoatType] = useState("");

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Export state
  const [isExporting, setIsExporting] = useState(false);

  // Fetch profile on mount
  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setIsLoadingProfile(true);
    try {
      const p = await getUserProfile();
      setLanguage(p.preferences?.language || "english");
      setNotifications(p.preferences?.notifications ?? true);
      setOfflineSync(p.preferences?.offlineSync ?? true);
      setUnits(p.preferences?.units || "kg");
      setBoatType(p.preferences?.boatType || "");
    } catch (err) {
      console.error("Failed to load profile:", err);
    } finally {
      setIsLoadingProfile(false);
    }
  }



  async function handleChangePassword() {
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setIsChangingPassword(true);
    try {
      await changePassword(oldPassword, newPassword);
      toast.success("Password changed successfully!");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordSection(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to change password");
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function handleSavePreferences() {
    try {
      await updateUserProfile({
        preferences: { language, notifications, offlineSync, units, boatType },
      });
      toast.success("Preferences saved!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save preferences");
    }
  }

  async function handleExportData() {
    setIsExporting(true);
    try {
      const csvContent = await exportUserData();
      // Create and trigger download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `oceanai-catch-data-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Catch data exported successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to export data");
    } finally {
      setIsExporting(false);
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirmText !== "DELETE") {
      toast.error('Please type "DELETE" to confirm');
      return;
    }
    setIsDeleting(true);
    try {
      await deleteUserAccount();
      toast.success("Account deleted successfully. Goodbye!");
      logout();
      router.push("/login");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete account");
    } finally {
      setIsDeleting(false);
    }
  }

  function handleLogout() {
    logout();
    router.push("/login");
  }



  if (isLoadingProfile) {
    return (
      <div className="max-w-4xl mx-auto py-20 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground font-medium">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Manage your security, preferences, and privacy.</p>
        </div>
        <Button variant="outline" className="rounded-xl h-11 font-bold gap-2" asChild>
          <Link href="/profile">
            <User className="w-4 h-4" /> My Profile
          </Link>
        </Button>
      </div>

      <div className="space-y-8">


        {/* ═══════════════════════════════════════════════════════════════════
            2. SECURITY — CHANGE PASSWORD
        ═════════════════════════════════════════════════════════════════════ */}
        <section className="space-y-6">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold">Security</h2>
          </div>

          <Card className="rounded-3xl border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
            <CardContent className="p-8 space-y-6">
              <div
                className="flex items-center justify-between p-4 rounded-2xl hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => setShowPasswordSection(!showPasswordSection)}
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-red-500/10 text-red-500 rounded-xl">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold">Change Password</h4>
                    <p className="text-sm text-muted-foreground">Update your account password</p>
                  </div>
                </div>
                <ChevronRight className={`w-5 h-5 text-muted-foreground transition-transform ${showPasswordSection ? "rotate-90" : ""}`} />
              </div>

              {showPasswordSection && (
                <div className="px-4 space-y-5 animate-in slide-in-from-top-2 duration-200">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Current Password</Label>
                    <div className="relative">
                      <Input
                        type={showOldPassword ? "text" : "password"}
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        placeholder="••••••••"
                        className="h-12 rounded-xl bg-muted/30 border-none px-4 pr-12 font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => setShowOldPassword(!showOldPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showOldPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">New Password</Label>
                      <div className="relative">
                        <Input
                          type={showNewPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="••••••••"
                          className="h-12 rounded-xl bg-muted/30 border-none px-4 pr-12 font-medium"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Confirm New Password</Label>
                      <Input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="h-12 rounded-xl bg-muted/30 border-none px-4 font-medium"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      className="rounded-xl h-12 px-8 bg-primary font-bold shadow-lg shadow-primary/20"
                      onClick={handleChangePassword}
                      disabled={isChangingPassword || !oldPassword || !newPassword || !confirmPassword}
                    >
                      {isChangingPassword ? (
                        <span className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Changing...
                        </span>
                      ) : (
                        "Change Password"
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            3. APP PREFERENCES
        ═════════════════════════════════════════════════════════════════════ */}
        <section className="space-y-6">
          <div className="flex items-center gap-2">
            <Languages className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold">App Preferences</h2>
          </div>

          <Card className="rounded-3xl border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
            <CardContent className="p-8 space-y-6">
              <div className="flex items-center justify-between p-4 rounded-2xl hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold">System Language</h4>
                    <p className="text-sm text-muted-foreground">Select your preferred Indian language</p>
                  </div>
                </div>
                <Select value={language} onValueChange={(v) => { setLanguage(v); }}>
                  <SelectTrigger className="w-40 h-10 rounded-lg border-border font-bold text-xs uppercase tracking-widest">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="english">English</SelectItem>
                    <SelectItem value="hindi">हिन्दी (Hindi)</SelectItem>
                    <SelectItem value="marathi">मराठी (Marathi)</SelectItem>
                    <SelectItem value="malayalam">മലയാളം (Malayalam)</SelectItem>
                    <SelectItem value="tamil">தமிழ் (Tamil)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between p-4 rounded-2xl hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold">Real-time Notifications</h4>
                    <p className="text-sm text-muted-foreground">Alerts for market prices and migration changes</p>
                  </div>
                </div>
                <Switch checked={notifications} onCheckedChange={setNotifications} />
              </div>

              <div className="flex items-center justify-between p-4 rounded-2xl hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold">Offline Sync</h4>
                    <p className="text-sm text-muted-foreground">Sync data when moving between sea and land</p>
                  </div>
                </div>
                <Switch checked={offlineSync} onCheckedChange={setOfflineSync} />
              </div>

              <div className="flex justify-end pt-2">
                <Button variant="outline" className="rounded-xl h-11 font-bold gap-2" onClick={handleSavePreferences}>
                  <Save className="w-4 h-4" /> Save Preferences
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            4. FISHING PREFERENCES
        ═════════════════════════════════════════════════════════════════════ */}
        <section className="space-y-6">
          <div className="flex items-center gap-2">
            <Anchor className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold">Fishing Preferences</h2>
          </div>

          <Card className="rounded-3xl border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
            <CardContent className="p-8 space-y-6">
              <div className="flex items-center justify-between p-4 rounded-2xl hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-violet-500/10 text-violet-500 rounded-xl">
                    <Scale className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold">Weight Units</h4>
                    <p className="text-sm text-muted-foreground">Preferred units for weight display</p>
                  </div>
                </div>
                <Select value={units} onValueChange={setUnits}>
                  <SelectTrigger className="w-32 h-10 rounded-lg border-border font-bold text-xs uppercase tracking-widest">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="kg">Kilograms</SelectItem>
                    <SelectItem value="lb">Pounds</SelectItem>
                    <SelectItem value="g">Grams</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between p-4 rounded-2xl hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-cyan-500/10 text-cyan-500 rounded-xl">
                    <Ship className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold">Boat Type</h4>
                    <p className="text-sm text-muted-foreground">Your primary fishing vessel</p>
                  </div>
                </div>
                <Select value={boatType} onValueChange={setBoatType}>
                  <SelectTrigger className="w-40 h-10 rounded-lg border-border font-bold text-xs uppercase tracking-widest">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="trawler">Trawler</SelectItem>
                    <SelectItem value="gillnetter">Gill Netter</SelectItem>
                    <SelectItem value="purse_seiner">Purse Seiner</SelectItem>
                    <SelectItem value="catamaran">Catamaran</SelectItem>
                    <SelectItem value="country_craft">Country Craft</SelectItem>
                    <SelectItem value="motorized">Motorized Boat</SelectItem>
                    <SelectItem value="non_motorized">Non-Motorized</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end pt-2">
                <Button variant="outline" className="rounded-xl h-11 font-bold gap-2" onClick={handleSavePreferences}>
                  <Save className="w-4 h-4" /> Save Preferences
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            5. DATA & PRIVACY
        ═════════════════════════════════════════════════════════════════════ */}
        <section className="space-y-6">
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold">Data & Privacy</h2>
          </div>

          <Card className="rounded-3xl border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
            <CardContent className="p-8 space-y-4">
              {/* Export Catch Data */}
              <button
                className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-muted/30 transition-colors text-left"
                onClick={handleExportData}
                disabled={isExporting}
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-teal-500/10 text-teal-500 rounded-xl">
                    {isExporting ? (
                      <div className="w-5 h-5 border-2 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
                    ) : (
                      <Download className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold">{isExporting ? "Exporting..." : "Export Catch Data"}</h4>
                    <p className="text-sm text-muted-foreground">Download all your catch history as CSV</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </button>

              {/* Delete Account */}
              <div className="space-y-4">
                <button
                  className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-red-500/5 transition-colors text-left"
                  onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-red-500/10 text-red-500 rounded-xl">
                      <Trash2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-red-500">Delete Account</h4>
                      <p className="text-sm text-muted-foreground">Permanently delete your account and all data</p>
                    </div>
                  </div>
                  <ChevronRight className={`w-5 h-5 text-muted-foreground transition-transform ${showDeleteConfirm ? "rotate-90" : ""}`} />
                </button>

                {showDeleteConfirm && (
                  <div className="mx-4 p-6 rounded-2xl bg-red-500/5 border border-red-500/20 space-y-4 animate-in slide-in-from-top-2 duration-200">
                    <div className="space-y-2">
                      <h4 className="font-bold text-red-500">⚠️ This action is irreversible</h4>
                      <p className="text-sm text-muted-foreground">
                        This will permanently delete your profile, all catch history, analysis results, chat conversations, and any other data associated with your account.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        Type <span className="text-red-500">DELETE</span> to confirm
                      </Label>
                      <Input
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        placeholder="Type DELETE to confirm"
                        className="h-12 rounded-xl bg-muted/30 border-red-500/20 px-4 font-medium focus-visible:ring-red-500/30"
                      />
                    </div>
                    <div className="flex gap-3 justify-end">
                      <Button
                        variant="outline"
                        className="rounded-xl h-11 font-bold"
                        onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); }}
                      >
                        Cancel
                      </Button>
                      <Button
                        className="rounded-xl h-11 px-8 bg-red-500 hover:bg-red-600 font-bold shadow-lg shadow-red-500/20"
                        onClick={handleDeleteAccount}
                        disabled={isDeleting || deleteConfirmText !== "DELETE"}
                      >
                        {isDeleting ? (
                          <span className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Deleting...
                          </span>
                        ) : (
                          "Delete My Account"
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </section>



        {/* ═══════════════════════════════════════════════════════════════════
            FOOTER ACTIONS
        ═════════════════════════════════════════════════════════════════════ */}
        <div className="pt-8 border-t border-border/50 flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex gap-3">
            <Button variant="ghost" className="rounded-xl h-12 px-6 text-red-500 hover:bg-red-500/10 font-bold gap-2" onClick={handleLogout}>
              <LogOut className="w-5 h-5" />
              Sign Out
            </Button>
          </div>
          <Button variant="ghost" className="rounded-xl h-12 px-6 text-muted-foreground hover:bg-muted/50 font-bold gap-2" onClick={() => router.push("/help")}>
            <HelpCircle className="w-5 h-5" />
            Help &amp; Documentation
          </Button>
        </div>
      </div>
    </div>
  );
}
