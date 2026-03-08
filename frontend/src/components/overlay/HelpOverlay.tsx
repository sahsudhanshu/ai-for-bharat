"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
    Search, ChevronDown, ChevronUp, Mail,
    Fish, BarChart2, MessageSquare,
    HelpCircle, BookOpen, Zap, Shield, Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ── FAQ Data ──────────────────────────────────────────────────────────────────
const FAQ_ITEMS = [
    {
        category: "Getting Started", icon: Zap, color: "text-amber-500", bg: "bg-amber-500/10",
        questions: [
            { q: "How do I upload my first catch?", a: "Navigate to Upload from the sidebar. Upload individual images or create a group analysis. Our AI analyzes each for species, weight, and freshness." },
            { q: "What image formats are supported?", a: "JPEG, PNG, and WebP. Take clear photos in natural light with fish fully visible for best results." },
            { q: "Is OceanAI available offline?", a: "Dashboard and analytics work offline if previously loaded. Image analysis requires internet." },
        ],
    },
    {
        category: "Fish Analysis", icon: Fish, color: "text-teal-500", bg: "bg-teal-500/10",
        questions: [
            { q: "How accurate is species identification?", a: "Over 90% accuracy for common Indian coastal species including Pomfret, Rohu, Catla, Hilsa, and Mackerel." },
            { q: "How is weight estimated?", a: "Computer vision analyzes length, girth, and shape. Results typically within ±10% of actual weight." },
            { q: "What does freshness mean?", a: "Classified from 'Very Fresh' to 'Not Fresh' based on eye clarity, gill color, and skin texture — helping determine market pricing." },
            { q: "What is group analysis?", a: "Analyze multiple fish at once for aggregate stats: total count, species distribution, combined weight." },
        ],
    },
    {
        category: "Analytics", icon: BarChart2, color: "text-indigo-500", bg: "bg-indigo-500/10",
        questions: [
            { q: "How do I generate a PDF report?", a: "Go to Analytics → Generate Report. Includes summary stats, species breakdown, earnings trends, and full history." },
            { q: "How are earnings estimated?", a: "Based on species, weight cross-referenced with typical market rates for your region." },
            { q: "Can I export data as CSV?", a: "Yes! Settings → Data & Privacy → Export Catch Data for full history with all analysis details." },
        ],
    },
    {
        category: "AI Assistant", icon: MessageSquare, color: "text-blue-500", bg: "bg-blue-500/10",
        questions: [
            { q: "What can I ask the AI?", a: "Catch history, species ID, fishing regulations, weather, market prices — the assistant uses your analysis history for context-aware answers." },
            { q: "Does it support Hindi?", a: "Yes! Understands Hindi, Tamil, Marathi, and other regional languages. Set preference in Settings." },
        ],
    },
    {
        category: "Privacy", icon: Shield, color: "text-purple-500", bg: "bg-purple-500/10",
        questions: [
            { q: "How is my data protected?", a: "All data encrypted at rest/transit. Images in AWS S3, analysis in DynamoDB. We never share personal data." },
            { q: "How do I delete my account?", a: "Settings → Data & Privacy → Delete Account. Type 'DELETE' to confirm. Irreversible." },
        ],
    },
];

// ── FAQ Item ──────────────────────────────────────────────────────────────────
function FAQItem({ question, answer }: { question: string; answer: string }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="border border-border/20 rounded-xl overflow-hidden transition-colors hover:border-border/40">
            <button
                className="w-full flex items-center justify-between p-3 text-left text-[13px] font-semibold gap-3 hover:bg-muted/10 transition-colors"
                onClick={() => setOpen(!open)}
            >
                <span className="min-w-0 leading-snug">{question}</span>
                {open
                    ? <ChevronUp className="w-3.5 h-3.5 shrink-0 text-primary" />
                    : <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground/40" />}
            </button>
            <div className={cn(
                "grid transition-all duration-200 ease-in-out",
                open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
            )}>
                <div className="overflow-hidden">
                    <div className="px-3 pb-3 text-xs text-muted-foreground/70 leading-relaxed">{answer}</div>
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════
// HELP OVERLAY — lightweight, no router, renders directly
// ═══════════════════════════════════════════════════════════════════

export default function HelpOverlay() {
    const [search, setSearch] = useState("");
    const [activeCategory, setActiveCategory] = useState("All");

    const categories = useMemo(() => ["All", ...FAQ_ITEMS.map((f) => f.category)], []);

    const filtered = useMemo(
        () => FAQ_ITEMS
            .map((s) => ({
                ...s, questions: s.questions.filter((q) =>
                    !search || q.q.toLowerCase().includes(search.toLowerCase()) || q.a.toLowerCase().includes(search.toLowerCase()),
                )
            }))
            .filter((s) => (activeCategory === "All" || s.category === activeCategory) && s.questions.length > 0),
        [search, activeCategory],
    );

    const setCategory = useCallback((c: string) => setActiveCategory(c), []);

    return (
        <div className="px-4 sm:px-6 py-5 sm:py-6 space-y-4">
            {/* Header */}
            <div className="space-y-1 pr-8">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight">Help & Support</h1>
                <p className="text-xs text-muted-foreground/60">Find answers or contact our team.</p>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
                <Input placeholder="Search FAQs..." value={search} onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-9 rounded-xl text-sm bg-muted/15 border-border/20 focus-visible:ring-primary/20" />
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-3 gap-2">
                {[
                    { icon: Mail, label: "Email", desc: "support@oceanai.app", color: "text-teal-500", bg: "bg-teal-500/10" },
                    { icon: BookOpen, label: "Docs", desc: "Guides & reference", color: "text-indigo-500", bg: "bg-indigo-500/10" },
                    { icon: Globe, label: "Status", desc: "All operational", color: "text-emerald-500", bg: "bg-emerald-500/10" },
                ].map(({ icon: Icon, label, desc, color, bg }) => (
                    <Card key={label} className="rounded-xl border-border/20 bg-card/30 cursor-pointer hover:bg-card/50 transition-colors">
                        <CardContent className="p-2.5 sm:p-3 flex flex-col items-center text-center gap-1.5">
                            <div className={cn("p-1.5 rounded-lg", bg, color)}><Icon className="w-3.5 h-3.5" /></div>
                            <div>
                                <p className="text-xs font-semibold">{label}</p>
                                <p className="text-[10px] text-muted-foreground/50 hidden sm:block">{desc}</p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap gap-1.5">
                {categories.map((cat) => (
                    <Button key={cat} variant={activeCategory === cat ? "default" : "outline"} size="sm"
                        className={cn("rounded-lg h-6 text-[10px] font-semibold px-2.5 border-border/20",
                            activeCategory === cat && "shadow-sm shadow-primary/15")}
                        onClick={() => setCategory(cat)}>
                        {cat}
                    </Button>
                ))}
            </div>

            {/* FAQ */}
            {filtered.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground/50">
                    <HelpCircle className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p className="text-xs font-bold">No results</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filtered.map((section) => {
                        const Icon = section.icon;
                        return (
                            <section key={section.category} className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <div className={cn("p-1 rounded-md", section.bg, section.color)}><Icon className="w-3 h-3" /></div>
                                    <h2 className="text-xs font-bold">{section.category}</h2>
                                    <Badge variant="secondary" className="rounded-md text-[9px] h-4 px-1.5 font-semibold">{section.questions.length}</Badge>
                                </div>
                                <div className="space-y-1">
                                    {section.questions.map((item) => <FAQItem key={item.q} question={item.q} answer={item.a} />)}
                                </div>
                            </section>
                        );
                    })}
                </div>
            )}

            {/* Still stuck? */}
            <Card className="rounded-xl border-border/20 bg-gradient-to-r from-teal-500/5 to-indigo-500/5">
                <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div>
                        <p className="text-xs font-bold">Still need help?</p>
                        <p className="text-[11px] text-muted-foreground/50">We respond within 24 hours.</p>
                    </div>
                    <Button size="sm" className="rounded-xl h-7 font-semibold text-[11px] shadow-sm shrink-0">
                        <Mail className="w-3 h-3 mr-1" /> Contact Us
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
