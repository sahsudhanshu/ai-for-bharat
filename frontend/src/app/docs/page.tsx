"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
    ArrowLeft, Anchor, Camera, BarChart2, MessageSquare,
    Settings, Shield, Fish, Upload, Globe, Zap, ChevronRight,
    Code, BookOpen, CheckCircle2, AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const DOCS_SECTIONS = [
    {
        id: "getting-started",
        icon: Zap,
        label: "Getting Started",
        color: "text-amber-500",
        articles: [
            {
                title: "Welcome to OceanAI",
                content: (
                    <div className="space-y-4">
                        <p className="text-muted-foreground leading-relaxed">
                            OceanAI is an AI-powered platform designed for Indian fishermen to identify fish species, estimate catch weight, assess freshness, and gain market insights — all from a smartphone photo.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {[
                                { icon: Camera, label: "Snap a photo", desc: "Upload any fish image from your device" },
                                { icon: Fish, label: "Get analysis", desc: "AI identifies species, weight, and freshness" },
                                { icon: BarChart2, label: "View analytics", desc: "Track earnings and catch trends over time" },
                                { icon: MessageSquare, label: "Ask the AI", desc: "Chat about your catch, market prices, and more" },
                            ].map(({ icon: Icon, label, desc }) => (
                                <div key={label} className="flex items-start gap-3 p-4 rounded-2xl bg-muted/30">
                                    <Icon className="w-5 h-5 text-primary mt-0.5" />
                                    <div>
                                        <p className="font-bold text-sm">{label}</p>
                                        <p className="text-xs text-muted-foreground">{desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ),
            },
            {
                title: "Creating your account",
                content: (
                    <div className="space-y-4 text-muted-foreground leading-relaxed">
                        <p>Sign up at the <strong className="text-foreground">/signup</strong> page using your email and a secure password. Your account is secured with AWS Cognito and protected with multi-factor authentication where available.</p>
                        <ol className="list-decimal pl-5 space-y-2">
                            <li>Enter your email and create a strong password (min 8 characters)</li>
                            <li>Complete your profile: name, fishing port, region, and boat type</li>
                            <li>Optionally enable a public profile for sharing your catch with buyers</li>
                            <li>Start uploading your first catch!</li>
                        </ol>
                    </div>
                ),
            },
        ],
    },
    {
        id: "upload-scan",
        icon: Upload,
        label: "Upload & Scan",
        color: "text-teal-500",
        articles: [
            {
                title: "Uploading a single image",
                content: (
                    <div className="space-y-4 text-muted-foreground leading-relaxed">
                        <p>Go to <strong className="text-foreground">Upload</strong> from the sidebar. Select or drag-and-drop a JPEG/PNG/WebP image of your fish.</p>
                        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex gap-3">
                            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-amber-500">For best accuracy: photograph the fish on a flat surface in natural daylight. Ensure the whole fish is visible.</p>
                        </div>
                        <p>The analysis is complete in under 10 seconds and gives you: species with confidence score, estimated weight in grams, freshness classification, and quality grade (A/B/C).</p>
                    </div>
                ),
            },
            {
                title: "Group (batch) analysis",
                content: (
                    <div className="space-y-4 text-muted-foreground leading-relaxed">
                        <p>Use <strong className="text-foreground">Group Analysis</strong> when you have an entire catch to evaluate. Upload multiple images in one session.</p>
                        <p>The system computes aggregate stats across all images:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Total fish count detected across all images</li>
                            <li>Species distribution (e.g., 60% Pomfret, 30% Rohu, 10% Other)</li>
                            <li>Combined estimated weight (kg)</li>
                            <li>Average freshness and overall quality grade</li>
                            <li>Disease/abnormality detection flag</li>
                        </ul>
                    </div>
                ),
            },
        ],
    },
    {
        id: "analytics",
        icon: BarChart2,
        label: "Analytics",
        color: "text-indigo-500",
        articles: [
            {
                title: "Understanding your dashboard",
                content: (
                    <div className="space-y-4 text-muted-foreground leading-relaxed">
                        <p>The Analytics page shows your performance over the last 6 months. Key metrics:</p>
                        <div className="space-y-2">
                            {[
                                ["Monthly Earnings", "Estimated total market value of your catch, in INR (₹)"],
                                ["Total Catch", "Combined weight of all analysed fish in kg"],
                                ["Top Species", "The most frequently caught species in your history"],
                                ["Total Catches", "Total number of individual fish analysed"],
                            ].map(([label, desc]) => (
                                <div key={label} className="flex gap-3 p-3 rounded-xl bg-muted/30">
                                    <CheckCircle2 className="w-4 h-4 text-teal-500 shrink-0 mt-0.5" />
                                    <div>
                                        <span className="font-bold text-foreground text-sm">{label}</span>
                                        <span className="text-sm"> — {desc}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ),
            },
            {
                title: "Generating a PDF report",
                content: (
                    <div className="space-y-3 text-muted-foreground leading-relaxed">
                        <p>Click <strong className="text-foreground">Generate Report</strong> on the Analytics page. A multi-page PDF is generated in your browser and downloaded automatically. No server required.</p>
                        <p>The PDF includes:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Cover page with your name and generation date</li>
                            <li>Summary statistics table</li>
                            <li>Species breakdown with percentage share</li>
                            <li>Weekly activity trend table</li>
                            <li>Full catch history table (paginated)</li>
                        </ul>
                    </div>
                ),
            },
        ],
    },
    {
        id: "chatbot",
        icon: MessageSquare,
        label: "AI Chatbot",
        color: "text-blue-500",
        articles: [
            {
                title: "What can the AI do?",
                content: (
                    <div className="space-y-4 text-muted-foreground leading-relaxed">
                        <p>The AI assistant has access to your catch history and can answer questions like:</p>
                        <div className="space-y-2">
                            {[
                                "\"What fish did I catch most last month?\"",
                                "\"Show me the details of my last group analysis\"",
                                "\"What is the current market price for Pomfret in Mumbai?\"",
                                "\"Which of my catches had quality grade A?\"",
                                "\"How much did I earn this week?\"",
                            ].map(q => (
                                <div key={q} className="flex gap-2 items-start p-3 rounded-xl bg-blue-500/10 text-blue-300 text-sm">
                                    <MessageSquare className="w-4 h-4 shrink-0 mt-0.5" /> {q}
                                </div>
                            ))}
                        </div>
                    </div>
                ),
            },
        ],
    },
    {
        id: "settings",
        icon: Settings,
        label: "Settings",
        color: "text-purple-500",
        articles: [
            {
                title: "Profile & preferences",
                content: (
                    <div className="space-y-3 text-muted-foreground leading-relaxed">
                        <p>From Settings, you can update your name, phone number, fishing port, and region. Changes are saved to the cloud immediately.</p>
                        <p>Preferences include:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li><strong className="text-foreground">Language</strong> — Interface language (English, Hindi, Tamil, etc.)</li>
                            <li><strong className="text-foreground">Units</strong> — kg or lbs for weight display</li>
                            <li><strong className="text-foreground">Notifications</strong> — Enable/disable push alerts</li>
                            <li><strong className="text-foreground">Offline Sync</strong> — Cache data for offline access</li>
                        </ul>
                    </div>
                ),
            },
            {
                title: "Public profile",
                content: (
                    <div className="space-y-3 text-muted-foreground leading-relaxed">
                        <p>Enable a public profile to get a shareable link like <code className="bg-muted px-1.5 py-0.5 rounded text-primary">oceanai.app/profile/your-name-id</code>. Anyone with the link can view your profile — no login needed.</p>
                        <p>You control what's visible:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Basic info: name, port, region, role, join date</li>
                            <li>Optional: fishing stats (total fish, species count, last catch)</li>
                        </ul>
                        <p>Turn off public profile at any time and the link will immediately become inaccessible.</p>
                    </div>
                ),
            },
        ],
    },
];

export default function DocsPage() {
    const router = useRouter();
    const [activeSection, setActiveSection] = useState(DOCS_SECTIONS[0].id);
    const [activeArticle, setActiveArticle] = useState(0);

    const section = DOCS_SECTIONS.find(s => s.id === activeSection) || DOCS_SECTIONS[0];
    const article = section.articles[activeArticle] || section.articles[0];

    return (
        <div className="max-w-6xl mx-auto pb-20">
            {/* Header */}
            <div className="flex items-center gap-3 mb-8">
                <Button variant="ghost" className="h-9 w-9 p-0 rounded-full" onClick={() => router.back()}>
                    <ArrowLeft className="w-4 h-4" />
                </Button>
                <h1 className="text-3xl font-bold">Documentation</h1>
            </div>

            <div className="flex flex-col lg:flex-row gap-8">
                {/* Sidebar */}
                <aside className="w-full lg:w-64 shrink-0">
                    <nav className="space-y-1 lg:sticky lg:top-4">
                        {DOCS_SECTIONS.map(sec => {
                            const Icon = sec.icon;
                            const isActive = activeSection === sec.id;
                            return (
                                <button
                                    key={sec.id}
                                    className={cn(
                                        "w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all font-medium text-sm",
                                        isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted/30 text-muted-foreground hover:text-foreground"
                                    )}
                                    onClick={() => { setActiveSection(sec.id); setActiveArticle(0); }}
                                >
                                    <Icon className="w-4 h-4 shrink-0" />
                                    {sec.label}
                                </button>
                            );
                        })}
                    </nav>
                </aside>

                {/* Content */}
                <main className="flex-1 min-w-0 space-y-6">
                    {/* Breadcrumb */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <BookOpen className="w-4 h-4" />
                        <span>Docs</span>
                        <ChevronRight className="w-3 h-3" />
                        <span>{section.label}</span>
                        <ChevronRight className="w-3 h-3" />
                        <span className="text-foreground font-medium">{article.title}</span>
                    </div>

                    {/* Article tabs */}
                    <div className="flex flex-wrap gap-2">
                        {section.articles.map((art, i) => (
                            <Button
                                key={art.title}
                                variant={activeArticle === i ? "default" : "outline"}
                                className="rounded-xl h-9 text-xs font-bold"
                                onClick={() => setActiveArticle(i)}
                            >
                                {art.title}
                            </Button>
                        ))}
                    </div>

                    {/* Article content */}
                    <div className="rounded-3xl border border-border/50 bg-card/50 p-8 animate-in fade-in duration-200">
                        <h2 className="text-2xl font-bold mb-6">{article.title}</h2>
                        {article.content}
                    </div>

                    {/* Next article */}
                    {section.articles[activeArticle + 1] && (
                        <button
                            className="w-full flex items-center justify-between p-5 rounded-2xl border border-border/50 bg-card/50 hover:border-primary/30 transition-colors text-left"
                            onClick={() => setActiveArticle(activeArticle + 1)}
                        >
                            <div>
                                <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mb-1">Next Article</p>
                                <p className="font-bold">{section.articles[activeArticle + 1].title}</p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-muted-foreground" />
                        </button>
                    )}
                </main>
            </div>
        </div>
    );
}
