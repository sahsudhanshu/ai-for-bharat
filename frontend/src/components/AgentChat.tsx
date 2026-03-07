"use client"

import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    Send, Mic, Bot, Volume2, Pause, Fish,
    Loader2, ImageIcon, Sparkles,
} from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { streamChat, createConversation, synthesizeSpeech, type GroupRecord } from "@/lib/api-client";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/i18n";
import { useVoiceInput } from "@/hooks/useVoiceInput";

// ── Types ──────────────────────────────────────────────────────────────────
interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
}

interface AgentChatProps {
    /** Compact mode for embedded panels; full for standalone page */
    variant?: 'compact' | 'full';
    /** Group ID to reference in queries */
    contextGroupId?: string | null;
    /** Current image index for multi-image context */
    contextImageIndex?: number;
    /** Total images in group */
    contextImageCount?: number;
    /** Species name for the current image */
    contextSpecies?: string;
    /** Optional class for the outer container */
    className?: string;
    /** Optional existing chat ID to continue */
    chatId?: string | null;
    /** Callback when a chatId is established */
    onChatIdChange?: (chatId: string) => void;
}

const MD_COMPONENTS: React.ComponentProps<typeof ReactMarkdown>['components'] = {
    p: ({ children }) => <p className="mb-3 last:mb-0 leading-relaxed text-[14px] sm:text-[15px] text-foreground/90 font-medium">{children}</p>,
    strong: ({ children }) => <strong className="font-bold text-foreground">{children}</strong>,
    em: ({ children }) => <em className="italic text-muted-foreground">{children}</em>,
    ul: ({ children }) => <ul className="my-3 space-y-1.5">{children}</ul>,
    ol: ({ children }) => <ol className="my-3 space-y-1.5 list-decimal list-outside ml-4">{children}</ol>,
    li: ({ children }) => (
        <li className="text-[14px] sm:text-[15px] items-start text-foreground/90 font-medium my-0.5">
            <span className="leading-relaxed">{children}</span>
        </li>
    ),
    code: ({ children }) => <code className="bg-muted px-1.5 py-0.5 rounded-md text-[13px] font-mono text-primary/80 font-semibold">{children}</code>,
    hr: () => <hr className="my-4 border-border/30" />,
    h3: ({ children }) => <h3 className="font-bold text-base sm:text-lg mt-4 mb-2">{children}</h3>,
    h4: ({ children }) => <h4 className="font-semibold text-sm sm:text-base mt-3 mb-1.5 text-foreground/80">{children}</h4>,
    blockquote: ({ children }) => <blockquote className="border-l-4 border-primary/30 pl-3 my-3 text-muted-foreground italic text-[14px] sm:text-[15px] bg-muted/20 py-1 pr-2 rounded-r-lg">{children}</blockquote>,
};

// ═══════════════════════════════════════════════════════════════════════════
export default function AgentChat({
    variant = 'full',
    contextGroupId = null,
    contextImageIndex = 0,
    contextImageCount = 0,
    contextSpecies = '',
    className,
    chatId: externalChatId = null,
    onChatIdChange,
}: AgentChatProps) {
    const { user } = useAuth();
    const { t, locale, speechCode } = useLanguage();
    const isCompact = variant === 'compact';

    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const [chatId, setChatId] = useState<string | null>(externalChatId);

    const [playingMsgId, setPlayingMsgId] = useState<string | null>(null);
    const isSynthesizingRef = useRef(false);
    const audioMapRef = useRef<Record<string, HTMLAudioElement>>({});

    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // ── Geolocation ──────────────────────────────────────────────────────────
    const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
    useEffect(() => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
            (pos) => setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
            () => { },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
        );
    }, []);

    // ── Welcome message ──────────────────────────────────────────────────────
    useEffect(() => {
        if (messages.length === 0) {
            const welcomeContent = contextGroupId
                ? `I've analyzed your catch${contextImageCount > 1 ? ` (${contextImageCount} images)` : ''}. ${contextSpecies ? `I can see **${contextSpecies}** in this image.` : ''} Ask me anything about your fish — species details, market value, sustainability, health status, or cooking tips!`
                : t('chat.welcome');
            setMessages([{
                id: 'welcome',
                role: 'assistant',
                content: welcomeContent,
                timestamp: new Date(),
            }]);
        }
    }, [contextGroupId, contextImageCount, contextSpecies]);

    // ── Update welcome when image changes ────────────────────────────────────
    useEffect(() => {
        if (contextGroupId && contextSpecies) {
            setMessages(prev => {
                // Add a system note about image switch
                const systemNote: Message = {
                    id: `ctx_${Date.now()}`,
                    role: 'system',
                    content: `Now viewing image ${contextImageIndex + 1}${contextImageCount ? ` of ${contextImageCount}` : ''}${contextSpecies ? ` — ${contextSpecies}` : ''}`,
                    timestamp: new Date(),
                };
                return [...prev, systemNote];
            });
        }
    }, [contextImageIndex]);

    // ── TTS ──────────────────────────────────────────────────────────────────
    const handlePlayPause = async (msg: Message) => {
        if (playingMsgId === msg.id) {
            audioMapRef.current[msg.id]?.pause();
            setPlayingMsgId(null);
            return;
        }
        if (playingMsgId && audioMapRef.current[playingMsgId]) {
            audioMapRef.current[playingMsgId].pause();
        }
        if (audioMapRef.current[msg.id]) {
            setPlayingMsgId(msg.id);
            audioMapRef.current[msg.id].play().catch(console.error);
            return;
        }
        if (isSynthesizingRef.current) return;
        try {
            isSynthesizingRef.current = true;
            const res = await synthesizeSpeech(msg.content, speechCode || 'en-IN');
            if (!res.audioBase64) return;
            const audio = new Audio(`data:audio/mp3;base64,${res.audioBase64}`);
            audioMapRef.current[msg.id] = audio;
            setPlayingMsgId(msg.id);
            audio.play().catch(console.error);
            audio.onended = () => setPlayingMsgId(prev => prev === msg.id ? null : prev);
        } catch {
            toast.error('Failed to generate audio.');
        } finally {
            isSynthesizingRef.current = false;
        }
    };

    // ── Voice input ───────────────────────────────────────────────────────────
    const { isListening, transcript, isSupported: voiceSupported, startListening, stopListening } = useVoiceInput({
        lang: speechCode, onResult: (t) => setInput(t), onError: (e) => toast.error(e),
    });
    useEffect(() => { if (isListening && transcript) setInput(transcript); }, [transcript, isListening]);

    // ── Auto scroll ──────────────────────────────────────────────────────────
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isTyping]);

    // ── Send ──────────────────────────────────────────────────────────────────
    const handleSend = useCallback(async (messageText?: string) => {
        const rawText = (messageText ?? input).trim();
        if (!rawText || isTyping) return;

        // Inject context about the current image if available
        let text = rawText;
        if (contextGroupId) {
            text = `[group:${contextGroupId}] [image:${contextImageIndex + 1}/${contextImageCount}] ${rawText}`;
        }

        const userMessage: Message = {
            id: `user_${Date.now()}`,
            role: 'user',
            content: rawText,
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, userMessage]);
        setInput("");
        setIsTyping(true);

        try {
            let targetChatId = chatId;
            if (!targetChatId) {
                try {
                    const newConv = await createConversation(rawText.substring(0, 40), locale);
                    targetChatId = newConv.conversationId;
                    setChatId(targetChatId);
                    onChatIdChange?.(targetChatId);
                } catch (e) { console.error("Failed to create conversation", e); }
            }

            const tempAiMsgId = `ai_temp_${Date.now()}`;
            setMessages(prev => [...prev, {
                id: tempAiMsgId, role: 'assistant', content: '', timestamp: new Date()
            }]);

            const res = await streamChat(text, (chunkText) => {
                setMessages(prev => prev.map(m =>
                    m.id === tempAiMsgId ? { ...m, content: m.content + chunkText } : m
                ));
            }, targetChatId ?? undefined, locale, userLocation ?? undefined);

            if (!targetChatId && res.chatId && !res.chatId.startsWith('demo_')) {
                setChatId(res.chatId);
                onChatIdChange?.(res.chatId);
            }

            if (res.messageId) {
                setMessages(prev => prev.map(m =>
                    m.id === tempAiMsgId ? { ...m, id: res.messageId! } : m
                ));
            }
        } catch (err) {
            console.error("Chat error:", err);
            setMessages(prev => [...prev, {
                id: `err_${Date.now()}`,
                role: 'assistant',
                content: "Sorry, I couldn't process that. Please try again.",
                timestamp: new Date(),
            }]);
        } finally {
            setIsTyping(false);
        }
    }, [input, isTyping, chatId, contextGroupId, contextImageIndex, contextImageCount, locale, userLocation, onChatIdChange]);

    // ── Quick action chips for compact mode ──────────────────────────────────
    const quickChips = contextGroupId ? [
        "Tell me about this fish",
        "Market value?",
        "Is it healthy?",
        "Cooking tips",
        "Sustainability info",
    ] : [
        "Identify fish species",
        "Sea conditions today",
        "Fishing regulations",
    ];

    // ═════════════════════════════════════════════════════════════════════════
    return (
        <div className={cn(
            "flex flex-col bg-card/30 backdrop-blur-sm rounded-2xl border border-border/20 overflow-hidden",
            isCompact ? "h-full" : "h-[calc(100dvh-185px)] sm:h-[calc(100dvh-210px)] lg:h-[calc(100dvh-140px)]",
            className,
        )}>
            {/* ── Header ── */}
            <div className={cn(
                "flex items-center gap-3 border-b border-border/15 shrink-0",
                isCompact ? "px-4 py-3" : "px-5 py-4"
            )}>
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                    <h3 className={cn("font-bold leading-tight", isCompact ? "text-sm" : "text-base")}>
                        {contextGroupId ? "AI Agent" : t('chat.title')}
                    </h3>
                    <p className="text-[10px] text-muted-foreground/60 leading-tight">
                        {contextGroupId
                            ? `Analyzing image ${contextImageIndex + 1}${contextImageCount ? ` of ${contextImageCount}` : ''}`
                            : "Ask me anything"
                        }
                    </p>
                </div>
                {isTyping && (
                    <div className="ml-auto flex items-center gap-1.5 text-[10px] text-primary/70 font-medium">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Thinking...
                    </div>
                )}
            </div>

            {/* ── Messages ── */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4" ref={scrollAreaRef}>
                <div className="space-y-3 pb-2">
                    {messages.map((msg) => {
                        // System context note
                        if (msg.role === 'system') return (
                            <div key={msg.id} className="flex justify-center animate-fade-in">
                                <div className="px-3 py-1 rounded-full bg-primary/5 border border-primary/10 text-[10px] text-primary/70 font-medium flex items-center gap-1.5">
                                    <ImageIcon className="w-3 h-3" />
                                    {msg.content}
                                </div>
                            </div>
                        );

                        return (
                            <div
                                key={msg.id}
                                className={cn(
                                    "group flex gap-3 sm:gap-4 animate-fade-in-up w-full",
                                    msg.role === 'user' ? "justify-end" : "justify-start"
                                )}
                                style={{ animationDuration: '0.3s' }}
                            >
                                {msg.role === 'assistant' && (
                                    <Avatar className={cn(
                                        "shrink-0 border border-primary/20",
                                        isCompact ? "h-7 w-7 mt-0.5" : "h-8 w-8 mt-1",
                                    )}>
                                        <div className="bg-primary/10 h-full w-full flex items-center justify-center">
                                            <Bot className={cn(isCompact ? "w-3.5 h-3.5" : "w-4 h-4", "text-primary")} />
                                        </div>
                                    </Avatar>
                                )}

                                <div className={cn(
                                    "space-y-1.5 min-w-0 flex flex-col",
                                    msg.role === 'user' ? "items-end" : "flex-1 items-start"
                                )}>
                                    <div className={cn(
                                        "leading-relaxed break-words",
                                        msg.role === 'user'
                                            ? "rounded-2xl bg-muted/50 border border-border/20 px-4 py-2 text-[14px] sm:text-[15px] font-medium text-foreground max-w-[85%]"
                                            : "py-1 w-full max-w-full sm:max-w-prose"
                                    )}>
                                        {msg.role === 'assistant' ? (
                                            msg.content ? (
                                                <div className="space-y-4">
                                                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
                                                        {msg.content}
                                                    </ReactMarkdown>
                                                </div>
                                            ) : (
                                                <div className="space-y-2 mt-2 w-[80%] max-w-[300px]">
                                                    <div className="h-4 bg-muted animate-pulse rounded-full w-full"></div>
                                                    <div className="h-4 bg-muted animate-pulse rounded-full w-5/6 shadow-sm"></div>
                                                    <div className="h-4 bg-muted animate-pulse rounded-full w-4/6 shadow-sm"></div>
                                                </div>
                                            )
                                        ) : (
                                            <span className="whitespace-pre-wrap">{msg.content}</span>
                                        )}
                                    </div>

                                    {/* Action row under message */}
                                    <div className={cn(
                                        "flex items-center gap-2",
                                        msg.role === 'user' ? "justify-end" : "justify-start mt-1"
                                    )}>
                                        {msg.role === 'assistant' && msg.content && !msg.id.startsWith('ai_temp_') && (
                                            <button
                                                onClick={() => handlePlayPause(msg)}
                                                className={cn(
                                                    "flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all",
                                                    playingMsgId === msg.id
                                                        ? "bg-primary/15 text-primary"
                                                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                                )}
                                            >
                                                {playingMsgId === msg.id ? <><Pause className="w-3 h-3" /> Pause</> : <><Volume2 className="w-3 h-3" /> Listen</>}
                                            </button>
                                        )}
                                        <span className="text-[9px] text-muted-foreground/30">
                                            {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={bottomRef} />
                </div>
            </div>

            {/* ── Quick chips ── */}
            {messages.length <= 2 && (
                <div className="px-3 pb-2 shrink-0">
                    <div className="flex flex-wrap gap-1.5">
                        {quickChips.map((chip, i) => (
                            <button
                                key={i}
                                onClick={() => handleSend(chip)}
                                disabled={isTyping}
                                className="px-2.5 py-1 rounded-full bg-primary/5 border border-primary/10 text-[11px] font-medium text-primary/70 hover:bg-primary/10 hover:text-primary transition-all duration-200 disabled:opacity-40"
                            >
                                {chip}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Voice indicator ── */}
            {isListening && (
                <div className="px-3 py-2 border-t border-red-500/10 bg-red-500/3 flex items-center gap-2 animate-fade-in shrink-0">
                    <div className="relative flex items-center justify-center">
                        <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
                        <div className="absolute w-4 h-4 bg-red-400/15 rounded-full animate-ping" />
                    </div>
                    <span className="text-xs font-medium text-red-400">Listening...</span>
                    <span className="text-[10px] text-muted-foreground/50 ml-auto">Tap mic to stop</span>
                </div>
            )}

            {/* ── Input bar ── */}
            <div className={cn(
                "border-t border-border/15 bg-background/20 shrink-0",
                isCompact ? "p-2.5" : "p-3"
            )}>
                <div className="flex items-center gap-1.5">
                    <Input
                        ref={inputRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                        placeholder={contextGroupId ? "Ask about this catch..." : t('chat.placeholder')}
                        disabled={isTyping}
                        className={cn(
                            "flex-1 pl-3 rounded-xl bg-muted/15 border-none focus-visible:ring-1 focus-visible:ring-primary/15",
                            isCompact ? "h-9 text-[13px]" : "h-10 text-sm"
                        )}
                    />
                    <button
                        onClick={() => { if (!voiceSupported) { toast.error(t('voice.notSupported')); return; } isListening ? stopListening() : startListening(); }}
                        disabled={isTyping}
                        className={cn(
                            "shrink-0 rounded-xl flex items-center justify-center transition-all",
                            isCompact ? "w-8 h-8" : "w-9 h-9",
                            isListening
                                ? "bg-red-500/15 text-red-400 shadow-sm"
                                : "bg-muted/15 text-muted-foreground/50 hover:bg-primary/5 hover:text-primary/70"
                        )}
                    >
                        <Mic className={cn(isCompact ? "w-3.5 h-3.5" : "w-4 h-4")} />
                    </button>
                    <button
                        onClick={() => handleSend()}
                        disabled={!input.trim() || isTyping}
                        className={cn(
                            "shrink-0 rounded-xl bg-primary text-white flex items-center justify-center shadow-sm shadow-primary/15 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed",
                            isCompact ? "w-8 h-8" : "w-9 h-9"
                        )}
                    >
                        {isTyping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    </button>
                </div>
            </div>
        </div>
    );
}
