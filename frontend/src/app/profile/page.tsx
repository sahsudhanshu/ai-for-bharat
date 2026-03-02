"use client"

import React, { useState, useEffect, useRef } from 'react';
import {
    User,
    Camera,
    Pencil,
    Save,
    Anchor,
    Scale,
    Globe,
    ExternalLink,
    ChevronRight,
    X,
    Copy,
    Link2,
    Settings,
    MapPin,
    Ship,
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { getUserProfile, updateUserProfile } from "@/lib/api-client";
import type { UserProfile } from "@/lib/api-client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ProfilePage() {
    const { user, updateUser } = useAuth();
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingProfile, setIsLoadingProfile] = useState(true);

    // Edit form state
    const [editName, setEditName] = useState("");
    const [editPhone, setEditPhone] = useState("");
    const [editPort, setEditPort] = useState("");
    const [editCustomPort, setEditCustomPort] = useState("");
    const [editRegion, setEditRegion] = useState("");
    const [editRole, setEditRole] = useState("");

    // Public profile state
    const [publicProfileEnabled, setPublicProfileEnabled] = useState(false);
    const [publicProfileSlug, setPublicProfileSlug] = useState("");
    const [showPublicStats, setShowPublicStats] = useState(false);
    const [isSavingPublicProfile, setIsSavingPublicProfile] = useState(false);

    // Avatar upload state
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

    useEffect(() => {
        loadProfile();
    }, []);

    async function loadProfile() {
        setIsLoadingProfile(true);
        try {
            const p = await getUserProfile();
            setProfile(p);
            setEditName(p.name || user?.name || "");
            setEditPhone(p.phone || "");
            setEditPort(p.port || "");
            setEditCustomPort(p.customPort || "");
            setEditRegion(p.region || "");
            setEditRole(p.role || "fisherman");
            setPublicProfileEnabled(p.publicProfileEnabled ?? false);
            setPublicProfileSlug(p.publicProfileSlug || "");
            setShowPublicStats((p as any).showPublicStats ?? false);
        } catch (err) {
            console.error("Failed to load profile:", err);
            if (user) {
                setEditName(user.name || "");
                setEditPhone(user.phone || "");
                setEditPort(user.port || "");
                setEditRegion(user.region || "");
                setEditRole(user.role || "fisherman");
            }
        } finally {
            setIsLoadingProfile(false);
        }
    }

    function startEditing() { setIsEditing(true); }

    function cancelEditing() {
        if (profile) {
            setEditName(profile.name || user?.name || "");
            setEditPhone(profile.phone || "");
            setEditPort(profile.port || "");
            setEditCustomPort(profile.customPort || "");
            setEditRegion(profile.region || "");
            setEditRole(profile.role || "fisherman");
        }
        setIsEditing(false);
    }

    async function handleSaveProfile() {
        setIsSaving(true);
        try {
            const data = {
                name: editName,
                email: user?.email || "",
                phone: editPhone,
                port: editPort,
                customPort: editPort === "other" ? editCustomPort : "",
                region: editRegion,
                role: editRole,
            };
            const result = await updateUserProfile(data);
            setProfile(result.profile);
            updateUser({ name: editName, phone: editPhone, port: editPort, region: editRegion, role: editRole });
            setIsEditing(false);
            toast.success("Profile saved successfully!");
        } catch (err: any) {
            toast.error(err.message || "Failed to save profile");
        } finally {
            setIsSaving(false);
        }
    }

    async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
        reader.readAsDataURL(file);

        setIsUploadingAvatar(true);
        try {
            const result = await updateUserProfile({}, file.name, file.type);
            if (result.avatarUploadUrl) {
                const xhr = new XMLHttpRequest();
                await new Promise<void>((resolve, reject) => {
                    xhr.open("PUT", result.avatarUploadUrl!, true);
                    xhr.setRequestHeader("Content-Type", file.type);
                    xhr.onload = () => {
                        if (xhr.status >= 200 && xhr.status < 300) resolve();
                        else reject(new Error(`Upload failed: ${xhr.status}`));
                    };
                    xhr.onerror = () => reject(new Error("Upload failed"));
                    xhr.send(file);
                });
            }
            const avatarUrl = result.avatarS3Url
                ? `${result.avatarS3Url}?t=${Date.now()}`
                : avatarPreview || "";
            setProfile((prev) => prev ? { ...prev, avatar: avatarUrl } : prev);
            updateUser({ avatar: avatarUrl });
            toast.success("Profile photo updated!");
        } catch (err: any) {
            console.error("Avatar upload error:", err);
            toast.error(err.message || "Failed to upload photo");
            setAvatarPreview(null);
        } finally {
            setIsUploadingAvatar(false);
        }
    }

    const displayAvatar = avatarPreview || profile?.avatar || user?.avatar || "";
    const displayName = profile?.name || user?.name || "User";
    const displayEmail = user?.email || profile?.email || "";
    const displayRole = profile?.role || user?.role || "fisherman";
    const displayRegion = profile?.region || user?.region || "";

    const userInitials = displayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

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
                    <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
                    <p className="text-muted-foreground">View and manage your personal information.</p>
                </div>
                <Button variant="outline" className="rounded-xl h-11 font-bold gap-2" asChild>
                    <Link href="/settings">
                        <Settings className="w-4 h-4" /> Settings
                    </Link>
                </Button>
            </div>

            <div className="space-y-8">
                {/* ═══════════════════════════════════════════════════════════════════
            PROFILE INFORMATION
        ═════════════════════════════════════════════════════════════════════ */}
                <section className="space-y-6">
                    <div className="flex items-center gap-2">
                        <User className="w-5 h-5 text-primary" />
                        <h2 className="text-xl font-bold">Profile Information</h2>
                    </div>

                    <Card className="rounded-3xl border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
                        <CardContent className="p-8 space-y-8">
                            {/* Avatar + Name Header */}
                            <div className="flex flex-col sm:flex-row items-center gap-8">
                                <div className="relative group">
                                    <Avatar className="h-24 w-24 border-4 border-primary/10 shadow-xl">
                                        <AvatarImage src={displayAvatar} />
                                        <AvatarFallback className="text-xl font-bold bg-primary/10 text-primary">{userInitials}</AvatarFallback>
                                    </Avatar>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        className="hidden"
                                        onChange={handleAvatarUpload}
                                    />
                                    <Button
                                        size="icon"
                                        className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-primary shadow-lg group-hover:scale-110 transition-transform"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={isUploadingAvatar}
                                    >
                                        {isUploadingAvatar ? (
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <Camera className="w-4 h-4" />
                                        )}
                                    </Button>
                                </div>
                                <div className="space-y-1 text-center sm:text-left flex-1">
                                    <h3 className="text-2xl font-bold">{displayName}</h3>
                                    <p className="text-muted-foreground font-medium">
                                        {displayRole}{displayRegion ? ` • ${displayRegion}` : ""}
                                    </p>
                                    <p className="text-sm text-muted-foreground">{displayEmail}</p>
                                    <div className="flex flex-wrap justify-center sm:justify-start gap-2 pt-2">
                                        <Badge className="bg-emerald-500/10 text-emerald-500 border-none px-3 py-1 font-bold text-[10px] uppercase">Verified Account</Badge>
                                    </div>
                                </div>
                                <div className="flex gap-2 sm:flex-col">
                                    {!isEditing ? (
                                        <Button variant="outline" className="rounded-xl border-border h-11 font-bold gap-2" onClick={startEditing}>
                                            <Pencil className="w-4 h-4" /> Edit Profile
                                        </Button>
                                    ) : (
                                        <>
                                            <Button className="rounded-xl h-11 px-6 bg-primary font-bold gap-2 shadow-lg shadow-primary/20" onClick={handleSaveProfile} disabled={isSaving}>
                                                {isSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                                                Save
                                            </Button>
                                            <Button variant="outline" className="rounded-xl h-11 px-6 font-bold gap-2" onClick={cancelEditing}>
                                                <X className="w-4 h-4" /> Cancel
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Profile Fields */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border/50">
                                <div className="space-y-2">
                                    <Label htmlFor="full-name" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Full Name</Label>
                                    <Input id="full-name" value={editName} onChange={(e) => setEditName(e.target.value)} disabled={!isEditing}
                                        className="h-12 rounded-xl bg-muted/30 border-none px-4 font-medium disabled:opacity-70" placeholder="Enter your full name" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">
                                        Email Address <span className="ml-2 text-[10px] text-muted-foreground/60 normal-case">(cannot be changed)</span>
                                    </Label>
                                    <Input id="email" value={displayEmail} disabled className="h-12 rounded-xl bg-muted/30 border-none px-4 font-medium opacity-60 cursor-not-allowed" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Phone Number</Label>
                                    <Input id="phone" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} disabled={!isEditing}
                                        className="h-12 rounded-xl bg-muted/30 border-none px-4 font-medium disabled:opacity-70" placeholder="+91 98765 43210" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="port" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Primary Fishing Port</Label>
                                    <Select value={editPort} onValueChange={(v) => { setEditPort(v); if (v !== "other") setEditCustomPort(""); }} disabled={!isEditing}>
                                        <SelectTrigger className="h-12 rounded-xl bg-muted/30 border-none px-4 font-medium disabled:opacity-70">
                                            <SelectValue placeholder="Select Port" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl">
                                            <SelectItem value="ratnagiri">Ratnagiri Port, Maharashtra</SelectItem>
                                            <SelectItem value="goa">Panaji Port, Goa</SelectItem>
                                            <SelectItem value="kochi">Kochi Port, Kerala</SelectItem>
                                            <SelectItem value="mumbai">Sassoon Dock, Mumbai</SelectItem>
                                            <SelectItem value="mangalore">Mangalore Port, Karnataka</SelectItem>
                                            <SelectItem value="vizag">Visakhapatnam Port, AP</SelectItem>
                                            <SelectItem value="chennai">Chennai Port, Tamil Nadu</SelectItem>
                                            <SelectItem value="paradip">Paradip Port, Odisha</SelectItem>
                                            <SelectItem value="other">Other (Enter Manually)</SelectItem>
                                            <SelectItem value="not_available">Not Available / Not Applicable</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {editPort === "other" && (
                                        <Input value={editCustomPort} onChange={(e) => setEditCustomPort(e.target.value)} disabled={!isEditing}
                                            className="h-12 rounded-xl bg-muted/30 border-none px-4 font-medium disabled:opacity-70 mt-2"
                                            placeholder="Enter your fishing port name" />
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="region" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Region</Label>
                                    <Input id="region" value={editRegion} onChange={(e) => setEditRegion(e.target.value)} disabled={!isEditing}
                                        className="h-12 rounded-xl bg-muted/30 border-none px-4 font-medium disabled:opacity-70" placeholder="e.g. Konkan Region" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="role" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Role</Label>
                                    <Select value={editRole} onValueChange={setEditRole} disabled={!isEditing}>
                                        <SelectTrigger className="h-12 rounded-xl bg-muted/30 border-none px-4 font-medium disabled:opacity-70">
                                            <SelectValue placeholder="Select Role" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl">
                                            <SelectItem value="fisherman">Fisherman</SelectItem>
                                            <SelectItem value="boat_owner">Boat Owner</SelectItem>
                                            <SelectItem value="trader">Fish Trader</SelectItem>
                                            <SelectItem value="cooperative_member">Cooperative Member</SelectItem>
                                            <SelectItem value="researcher">Researcher</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </section>

                {/* ═══════════════════════════════════════════════════════════════════
            PUBLIC PROFILE
        ═════════════════════════════════════════════════════════════════════ */}
                <section className="space-y-6">
                    <div className="flex items-center gap-2">
                        <Globe className="w-5 h-5 text-primary" />
                        <h2 className="text-xl font-bold">Public Profile</h2>
                    </div>

                    <Card className="rounded-3xl border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
                        <CardContent className="p-8 space-y-6">
                            <div className="flex items-center justify-between p-4 rounded-2xl hover:bg-muted/30 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-xl">
                                        <ExternalLink className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold">Enable Public Profile</h4>
                                        <p className="text-sm text-muted-foreground">Allow others to view your fisherman profile</p>
                                    </div>
                                </div>
                                <Switch
                                    checked={publicProfileEnabled}
                                    onCheckedChange={async (checked) => {
                                        setPublicProfileEnabled(checked);
                                        let slug = publicProfileSlug;
                                        if (checked && !slug) {
                                            const baseName = (editName || user?.name || "fisherman")
                                                .toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").slice(0, 20);
                                            slug = `${baseName}-${(user?.id || "").slice(0, 8)}`;
                                            setPublicProfileSlug(slug);
                                        }
                                        setIsSavingPublicProfile(true);
                                        try {
                                            await updateUserProfile({
                                                publicProfileEnabled: checked,
                                                publicProfileSlug: slug,
                                            } as any);
                                            toast.success(checked ? "Public profile enabled!" : "Public profile disabled");
                                        } catch {
                                            toast.error("Failed to update public profile setting");
                                            setPublicProfileEnabled(!checked);
                                        } finally {
                                            setIsSavingPublicProfile(false);
                                        }
                                    }}
                                />
                            </div>

                            {publicProfileEnabled && publicProfileSlug && (
                                <div className="px-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
                                    {/* Show Public Stats toggle */}
                                    <div className="flex items-center justify-between p-4 rounded-2xl hover:bg-muted/30 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-teal-500/10 text-teal-500 rounded-xl">
                                                <Scale className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold">Show Fishing Statistics</h4>
                                                <p className="text-sm text-muted-foreground">Display your catch count and species stats publicly</p>
                                            </div>
                                        </div>
                                        <Switch
                                            checked={showPublicStats}
                                            onCheckedChange={async (checked) => {
                                                setShowPublicStats(checked);
                                                try {
                                                    await updateUserProfile({ showPublicStats: checked } as any);
                                                    toast.success(checked ? "Stats will show on your public profile!" : "Stats hidden from public profile");
                                                } catch {
                                                    setShowPublicStats(!checked);
                                                    toast.error("Failed to update stats visibility");
                                                }
                                            }}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Your Public Profile URL</Label>
                                        <div className="flex gap-2">
                                            <div className="flex-1 flex items-center h-12 rounded-xl bg-muted/30 px-4 font-medium text-sm">
                                                <Link2 className="w-4 h-4 text-muted-foreground mr-2 flex-shrink-0" />
                                                <span className="text-muted-foreground truncate">
                                                    {typeof window !== "undefined" ? window.location.origin : ""}/profile/{publicProfileSlug}
                                                </span>
                                            </div>
                                            <Button
                                                variant="outline"
                                                className="rounded-xl h-12 px-4 font-bold gap-2"
                                                onClick={() => {
                                                    const url = `${window.location.origin}/profile/${publicProfileSlug}`;
                                                    navigator.clipboard.writeText(url);
                                                    toast.success("Profile URL copied to clipboard!");
                                                }}
                                            >
                                                <Copy className="w-4 h-4" /> Copy
                                            </Button>
                                        </div>
                                    </div>
                                    <Button
                                        variant="outline"
                                        className="rounded-xl h-11 font-bold gap-2"
                                        onClick={() => router.push(`/profile/${publicProfileSlug}`)}
                                    >
                                        <ExternalLink className="w-4 h-4" /> Preview Profile
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </section>
            </div>
        </div>
    );
}
