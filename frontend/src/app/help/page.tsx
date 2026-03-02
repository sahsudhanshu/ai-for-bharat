"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
    Search, ChevronDown, ChevronRight, ExternalLink, Mail,
    Anchor, Fish, Camera, BarChart2, MessageSquare, Settings,
    HelpCircle, BookOpen, Zap, Shield, Globe, CheckCircle2,
    ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const FAQ_ITEMS = [
    {
        category: "Getting Started",
        icon: Zap,
        color: "text-amber-500",
        bg: "bg-amber-500/10",
        questions: [
            {
                q: "How do I upload my first catch for analysis?",
                a: "Navigate to the Upload page from the sidebar. You can upload individual images or create a group analysis by uploading multiple images together. Our AI will analyze each image for species, weight, and freshness."
            },
            {
                q: "What image formats are supported?",
                a: "OceanAI supports JPEG, PNG, and WebP images. For best results, take clear photos in natural light with the fish fully visible. Avoid blurry or dark images."
            },
            {
                q: "Is OceanAI available offline?",
                a: "The dashboard and analytics work offline if you've previously loaded them. However, image analysis requires an internet connection to process through our AI models."
            }
        ]
    },
    {
        category: "Fish Analysis",
        icon: Fish,
        color: "text-teal-500",
        bg: "bg-teal-500/10",
        questions: [
            {
                q: "How accurate is the species identification?",
                a: "Our AI model achieves over 90% accuracy for common Indian coastal fish species including Pomfret, Rohu, Catla, Hilsa, and Mackerel. Accuracy may vary for rare species or heavily processed fish."
            },
            {
                q: "How is the weight estimated?",
                a: "Weight estimation uses computer vision to analyze the fish's length, girth, and shape from the image. Results are in grams and typically fall within ±10% of the actual weight. Weight estimation works best when the fish is photographed next to a known reference object."
            },
            {
                q: "What does the freshness classification mean?",
                a: "Freshness is classified on a scale from 'Very Fresh' to 'Not Fresh' based on visual indicators like eye clarity, gill color, skin texture, and scales. This classification helps determine the best market price and appropriate storage method."
            },
            {
                q: "What is a group analysis?",
                a: "A group analysis allows you to analyze multiple fish or a batch catch at once. Upload several images and the system will compute aggregate stats: total fish count, species distribution, combined weight, and overall quality grade."
            }
        ]
    },
    {
        category: "Analytics & Reports",
        icon: BarChart2,
        color: "text-indigo-500",
        bg: "bg-indigo-500/10",
        questions: [
            {
                q: "How do I generate a PDF report?",
                a: "Go to the Analytics page and click 'Generate Report'. A PDF will be generated and downloaded automatically. It includes your summary stats, species breakdown, weekly earnings trend, and full catch history."
            },
            {
                q: "How is my earnings estimate calculated?",
                a: "Earnings are estimated based on the species identified, weight, and quality grade of your catch, cross-referenced with typical market rates for your region. These are estimates only — actual prices may vary."
            },
            {
                q: "Can I export my data as a CSV?",
                a: "Yes! Go to Settings → Data & Privacy → Export Catch Data. Your full catch history will be exported as a CSV with species, weight, freshness, location, and date for every analysis."
            }
        ]
    },
    {
        category: "AI Chatbot",
        icon: MessageSquare,
        color: "text-blue-500",
        bg: "bg-blue-500/10",
        questions: [
            {
                q: "What can I ask the AI assistant?",
                a: "You can ask about your catch history, species identification, fishing regulations, weather insights, market prices, and more. The assistant has access to your analysis history and can answer context-aware questions."
            },
            {
                q: "Does the chatbot support Hindi?",
                a: "Yes! The chatbot can understand and respond in Hindi, Tamil, Marathi, and other regional languages. You can ask questions in your preferred language. Use the language toggle in Settings to set your preferred interface language."
            }
        ]
    },
    {
        category: "Account & Privacy",
        icon: Shield,
        color: "text-purple-500",
        bg: "bg-purple-500/10",
        questions: [
            {
                q: "How is my data stored and protected?",
                a: "All your data is encrypted at rest and in transit. Images are stored in AWS S3 with private access controls. Analysis results are stored in DynamoDB. We never share your personal data with third parties."
            },
            {
                q: "How do I delete my account?",
                a: "Go to Settings → Data & Privacy → Delete Account. Type 'DELETE' to confirm. This will permanently remove your profile, all images, analysis results, and chat history. This action cannot be undone."
            },
            {
                q: "What is a public profile?",
                a: "A public profile allows other fishermen, buyers, or cooperatives to view your basic profile information and optionally your catch statistics, via a unique shareable link. You can enable or disable it anytime in Settings → Public Profile."
            }
        ]
    }
];

function FAQItem({ question, answer }: { question: string; answer: string }) {
    const [open, setOpen] = useState(false);
    return (
        <div
            className="border border-border/50 rounded-2xl overflow-hidden transition-all hover:border-primary/30"
        >
            <button
                className="w-full flex items-center justify-between p-5 text-left font-bold gap-4 hover:bg-muted/20 transition-colors"
                onClick={() => setOpen(!open)}
            >
                <span>{question}</span>
                {open ? <ChevronDown className="w-5 h-5 shrink-0 text-primary" /> : <ChevronRight className="w-5 h-5 shrink-0 text-muted-foreground" />}
            </button>
            {open && (
                <div className="px-5 pb-5 text-muted-foreground text-sm leading-relaxed animate-in slide-in-from-top-1 duration-150">
                    {answer}
                </div>
            )}
        </div>
    );
}

export default function HelpPage() {
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [activeCategory, setActiveCategory] = useState("All");

    const categories = ["All", ...FAQ_ITEMS.map(f => f.category)];

    const filtered = FAQ_ITEMS.map(section => ({
        ...section,
        questions: section.questions.filter(q =>
            search === "" ||
            q.q.toLowerCase().includes(search.toLowerCase()) ||
            q.a.toLowerCase().includes(search.toLowerCase())
        )
    })).filter(section =>
        (activeCategory === "All" || section.category === activeCategory) &&
        section.questions.length > 0
    );

    return (
        <div className="max-w-4xl mx-auto space-y-10 pb-20">
            {/* Header */}
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        className="h-9 w-9 p-0 rounded-full"
                        onClick={() => router.back()}
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <h1 className="text-3xl font-bold">Help & Support</h1>
                </div>
                <p className="text-muted-foreground">
                    Find answers to common questions or get in touch with our support team.
                </p>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                    placeholder="Search FAQs..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-12 h-14 rounded-2xl text-base bg-muted/30 border-none focus-visible:ring-primary/30"
                />
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                    {
                        icon: Mail,
                        label: "Email Support",
                        desc: "support@oceanai.app",
                        color: "text-teal-500",
                        bg: "bg-teal-500/10",
                    },
                    {
                        icon: BookOpen,
                        label: "Documentation",
                        desc: "Full guides & API reference",
                        color: "text-indigo-500",
                        bg: "bg-indigo-500/10",
                        onClick: () => router.push("/docs"),
                    },
                    {
                        icon: Globe,
                        label: "System Status",
                        desc: "All systems operational",
                        color: "text-emerald-500",
                        bg: "bg-emerald-500/10",
                    },
                ].map(({ icon: Icon, label, desc, color, bg, onClick }) => (
                    <Card
                        key={label}
                        className="rounded-3xl border-border/50 bg-card/50 cursor-pointer hover:border-border transition-colors"
                        onClick={onClick}
                    >
                        <CardContent className="p-6 flex items-center gap-4">
                            <div className={`p-3 ${bg} ${color} rounded-2xl`}>
                                <Icon className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="font-bold">{label}</p>
                                <p className="text-xs text-muted-foreground">{desc}</p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap gap-2">
                {categories.map(cat => (
                    <Button
                        key={cat}
                        variant={activeCategory === cat ? "default" : "outline"}
                        className="rounded-xl h-9 text-xs font-bold"
                        onClick={() => setActiveCategory(cat)}
                    >
                        {cat}
                    </Button>
                ))}
            </div>

            {/* FAQ Sections */}
            {filtered.length === 0 ? (
                <div className="py-20 text-center text-muted-foreground">
                    <HelpCircle className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p className="font-bold text-lg">No results found</p>
                    <p className="text-sm">Try a different search term or browse all categories.</p>
                </div>
            ) : (
                filtered.map(section => {
                    const Icon = section.icon;
                    return (
                        <section key={section.category} className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 ${section.bg} ${section.color} rounded-xl`}>
                                    <Icon className="w-4 h-4" />
                                </div>
                                <h2 className="text-lg font-bold">{section.category}</h2>
                                <Badge variant="secondary" className="rounded-full text-xs">
                                    {section.questions.length} answers
                                </Badge>
                            </div>
                            <div className="space-y-2">
                                {section.questions.map(item => (
                                    <FAQItem key={item.q} question={item.q} answer={item.a} />
                                ))}
                            </div>
                        </section>
                    );
                })
            )}

            {/* Still stuck? */}
            <Card className="rounded-3xl border-border/50 bg-gradient-to-r from-teal-500/10 to-indigo-500/10">
                <CardContent className="p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div>
                        <p className="font-bold text-xl mb-1">Still need help?</p>
                        <p className="text-muted-foreground text-sm">
                            Our support team typically responds within 24 hours.
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="outline" className="rounded-xl font-bold" onClick={() => router.push("/docs")}>
                            <BookOpen className="w-4 h-4 mr-2" /> Docs
                        </Button>
                        <Button className="rounded-xl font-bold">
                            <Mail className="w-4 h-4 mr-2" /> Contact Us
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
