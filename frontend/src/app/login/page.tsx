"use client"

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Fish, Mail, Lock, Eye, EyeOff, ArrowRight, Anchor, Waves } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function LoginPage() {
    const { login, register } = useAuth();
    const router = useRouter();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [mode, setMode] = useState<"login" | "signup">("login");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) { toast.error("Email is required"); return; }
        if (!password.trim()) { toast.error("Password is required"); return; }
        const normalizedEmail = email.trim();
        const normalizedPassword = password.trim();
        setIsLoading(true);
        try {
            if (mode === "login") {
                await login(normalizedEmail, normalizedPassword);
                toast.success("Welcome back! 🐟");
                router.push("/");
            } else {
                if (!name.trim()) { toast.error("Name is required"); setIsLoading(false); return; }
                await register(name.trim(), normalizedEmail, normalizedPassword, "");
                toast.success("Account created! Please sign in.");
                setMode("login");
            }
        } catch (err: any) {
            toast.error(err.message || "Request failed. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex">
            {/* Left Panel — Hero */}
            <div className="hidden lg:flex lg:w-1/2 bg-ocean-gradient relative overflow-hidden flex-col justify-between p-12">
                {/* Decorative circles */}
                <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full border border-white/5" />
                <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full border border-white/5" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-125 h-125 rounded-full border border-white/5" />
                <svg className="absolute inset-0 w-full h-full opacity-5" viewBox="0 0 800 600">
                    <path d="M0 300 Q200 100 400 300 Q600 500 800 300" stroke="white" fill="none" strokeWidth="2" />
                    <path d="M0 400 Q200 200 400 400 Q600 600 800 400" stroke="white" fill="none" strokeWidth="2" />
                </svg>

                {/* Logo */}
                <div className="relative z-10 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center">
                        <Fish className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <p className="text-white font-bold text-xl">OceanAI</p>
                        <p className="text-white/50 text-xs">AI for Bharat</p>
                    </div>
                </div>

                {/* Tagline */}
                <div className="relative z-10 space-y-6">
                    <Badge className="bg-white/15 text-white border-none px-4 py-1.5 text-xs font-bold uppercase tracking-wider backdrop-blur-md">
                        AWS AI for Bharat Challenge
                    </Badge>
                    <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight">
                        Empowering India's<br />
                        <span className="text-amber-400">28 Million</span><br />
                        Fishermen
                    </h1>
                    <p className="text-white/60 text-lg leading-relaxed max-w-md">
                        AI-powered fish identification, weight estimation, and market intelligence — all from a single photo.
                    </p>
                </div>

                {/* Stats */}
                <div className="relative z-10 grid grid-cols-3 gap-6">
                    {[
                        { value: "95%", label: "ID Accuracy", icon: Fish },
                        { value: "90%", label: "Weight Accuracy", icon: Anchor },
                        { value: "<3s", label: "Response Time", icon: Waves },
                    ].map((stat, i) => (
                        <div key={i} className="space-y-2">
                            <p className="text-2xl font-bold text-white">{stat.value}</p>
                            <p className="text-white/50 text-sm font-medium">{stat.label}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right Panel — Form */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12">
                {/* Mobile Logo */}
                <div className="lg:hidden flex items-center gap-3 mb-10">
                    <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <Fish className="w-5 h-5 text-primary" />
                    </div>
                    <p className="font-bold text-xl">OceanAI</p>
                </div>

                <div className="w-full max-w-md space-y-8">
                    <div className="space-y-2">
                        <h2 className="text-3xl font-bold">
                            {mode === "login" ? "Welcome back" : "Create account"}
                        </h2>
                        <p className="text-muted-foreground">
                            {mode === "login" ? "Sign in to your OceanAI dashboard" : "Start your AI fishing journey today"}
                        </p>
                    </div>

                    {/* Mode Toggle */}
                    <div className="flex rounded-2xl bg-muted/30 p-1">
                        {(["login", "signup"] as const).map((m) => (
                            <button
                                key={m}
                                onClick={() => setMode(m)}
                                className={cn(
                                    "flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-200",
                                    mode === m ? "bg-background shadow-md text-foreground" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {m === "login" ? "Sign In" : "Sign Up"}
                            </button>
                        ))}
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {mode === "signup" && (
                            <div className="space-y-2">
                                <Label htmlFor="name" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Full Name</Label>
                                <Input
                                    id="name"
                                    placeholder="Ram Mohan"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="h-13 rounded-xl bg-muted/30 border-none focus-visible:ring-2 focus-visible:ring-primary/20 px-4 font-medium"
                                />
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Email Address</Label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="fisherman@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="h-13 rounded-xl bg-muted/30 border-none focus-visible:ring-2 focus-visible:ring-primary/20 pl-11 pr-4 font-medium"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Password</Label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="h-13 rounded-xl bg-muted/30 border-none focus-visible:ring-2 focus-visible:ring-primary/20 pl-11 pr-12 font-medium"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="w-full h-13 rounded-xl bg-primary font-bold text-base shadow-lg shadow-primary/20 transition-all active:scale-95"
                        >
                            {isLoading ? (
                                <span className="flex items-center gap-2">
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    {mode === "login" ? "Signing in..." : "Creating account..."}
                                </span>
                            ) : (
                                <span className="flex items-center gap-2">
                                    {mode === "login" ? "Sign In" : "Create Account"}
                                    <ArrowRight className="w-4 h-4" />
                                </span>
                            )}
                        </Button>
                    </form>

                    <p className="text-center text-xs text-muted-foreground">
                        By continuing, you agree to our{" "}
                        <a href="#" className="text-primary font-bold hover:underline">Terms of Service</a>
                        {" "}and{" "}
                        <a href="#" className="text-primary font-bold hover:underline">Privacy Policy</a>
                    </p>
                </div>
            </div>
        </div>
    );
}
