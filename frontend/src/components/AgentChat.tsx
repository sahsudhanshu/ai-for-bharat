"use client"

import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    Send, Mic, Bot, Volume2, Pause, Fish,
    Loader2, ImageIcon, Sparkles, Check, CheckCheck, AlertCircle,
    MapPin, Upload, BarChart3, X, Reply
} from 'lucide-react';
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { streamChat, createConversation, synthesizeSpeech, getConversationMessagesPage, type GroupRecord, type Conversation } from "@/lib/api-client";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/i18n";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { formatMessageTimestamp } from "@/lib/utils/timestamp";
import { useAgentFirstStore } from '@/lib/stores/agent-first-store';
import CapabilityCards from '@/components/agent/CapabilityCards';
import { AnimatePresence, motion } from 'framer-motion';

// ── Types ──────────────────────────────────────────────────────────────────
type MessageStatus = 'sending' | 'sent' | 'failed';

interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    status?: MessageStatus;
    isPaneMessage?: boolean; // Flag to indicate message from ContentCanvas component
    paneSource?: 'upload' | 'map' | 'analytics' | 'history'; // Source component for PaneMessage
    replyTo?: string; // Add reply context
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
    /** Force-reset token for explicit New Chat actions */
    resetToken?: number;
    /** Callback when a chatId is established */
    onChatIdChange?: (chatId: string) => void;
    /** Optional initial conversation history for session restore */
    initialMessages?: Message[];
    /** Callback when conversation history changes */
    onMessagesChange?: (messages: Message[]) => void;
    /** Callback when a new conversation is created */
    onNewConversationCreated?: (conv: Conversation) => void;
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

// ── Message Status Indicator ───────────────────────────────────────────────
function MessageStatusIndicator({ status }: { status?: MessageStatus }) {
    if (!status) return null;

    switch (status) {
        case 'sending':
            return (
                <div className="flex items-center gap-1 text-muted-foreground/50">
                    <Loader2 className="w-3 h-3 animate-spin" />
                </div>
            );
        case 'sent':
            return (
                <div className="flex items-center gap-1 text-primary/50">
                    <CheckCheck className="w-3 h-3" />
                </div>
            );
        case 'failed':
            return (
                <div className="flex items-center gap-1 text-red-500/70">
                    <AlertCircle className="w-3 h-3" />
                </div>
            );
        default:
            return null;
    }
}

// ── Message Row Component ──────────────────────────────────────────────────
interface MessageRowProps {
    message: Message;
    isCompact: boolean;
    isStreaming: boolean;
    playingMsgId: string | null;
    synthesizingMsgId: string | null;
    onPlayPause: (msg: Message) => void;
    style?: React.CSSProperties;
}

function MessageRow({ message: msg, isCompact, isStreaming, playingMsgId, synthesizingMsgId, onPlayPause, style }: MessageRowProps) {
    const { locale } = useLanguage();

    // System context note
    if (msg.role === 'system') {
        return (
            <div style={style} className="flex justify-center animate-fade-in px-3 py-2">
                <div className="px-3 py-1 rounded-full bg-primary/5 border border-primary/10 text-[10px] text-primary/70 font-medium flex items-center gap-1.5">
                    <ImageIcon className="w-3 h-3" />
                    {msg.content}
                </div>
            </div>
        );
    }

    // Get PaneMessage badge icon
    const getPaneMessageIcon = () => {
        if (!msg.isPaneMessage || !msg.paneSource) return null;

        switch (msg.paneSource) {
            case 'map':
                return <MapPin className="w-3 h-3" />;
            case 'upload':
                return <Upload className="w-3 h-3" />;
            case 'analytics':
                return <BarChart3 className="w-3 h-3" />;
            default:
                return null;
        }
    };

    const getPaneMessageLabel = () => {
        if (!msg.isPaneMessage || !msg.paneSource) return null;

        switch (msg.paneSource) {
            case 'map':
                return 'Map';
            case 'upload':
                return 'Upload';
            case 'analytics':
                return 'Analytics';
            case 'history':
                return 'History';
            default:
                return null;
        }
    };

    return (
        <div
            style={style}
            className={cn(
                "group flex gap-2.5 sm:gap-3 animate-fade-in-up w-full px-2 py-0.5",
                msg.role === 'user' ? "justify-end" : "justify-start"
            )}
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
                {/* PaneMessage badge - shown above user messages */}
                {msg.role === 'user' && msg.isPaneMessage && (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[9px] text-primary/80 font-medium">
                        {getPaneMessageIcon()}
                        <span>{getPaneMessageLabel()}</span>
                    </div>
                )}

                <div className={cn(
                    "leading-relaxed break-words",
                    msg.role === 'user'
                        ? "rounded-2xl rounded-tr-md bg-primary text-primary-foreground shadow-md px-3.5 py-2 text-[13px] sm:text-[14px] font-medium max-w-[85%]"
                        : "py-0.5 w-full max-w-full sm:max-w-prose"
                )}>
                    {msg.role === 'assistant' ? (
                        msg.content ? (
                            msg.id.startsWith('ai_temp_') && isStreaming ? (
                                <p className="whitespace-pre-wrap text-[14px] sm:text-[15px] text-foreground/90 leading-relaxed">
                                    {msg.content}
                                </p>
                            ) : (
                                <div className="space-y-4">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
                                        {msg.content}
                                    </ReactMarkdown>
                                </div>
                            )
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
                    {msg.role === 'assistant' && msg.content && !isStreaming && (
                        <button
                            onClick={() => onPlayPause(msg)}
                            disabled={Boolean(synthesizingMsgId && synthesizingMsgId !== msg.id)}
                            className={cn(
                                "flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all",
                                playingMsgId === msg.id
                                    ? "bg-primary/15 text-primary"
                                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                                synthesizingMsgId && synthesizingMsgId !== msg.id && "opacity-60 cursor-not-allowed"
                            )}
                        >
                            {synthesizingMsgId === msg.id ? (
                                <><Loader2 className="w-3 h-3 animate-spin" /> Loading</>
                            ) : playingMsgId === msg.id ? (
                                <><Pause className="w-3 h-3" /> Pause</>
                            ) : (
                                <><Volume2 className="w-3 h-3" /> Listen</>
                            )}
                        </button>
                    )}
                    {msg.content && msg.role === 'assistant' && !isStreaming && (
                        <button
                            onClick={() => (window as any).dispatchReply?.(msg)}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all text-muted-foreground hover:bg-muted/50 hover:text-foreground ml-1 mr-2"
                        >
                            <Reply className="w-3 h-3" /> Reply
                        </button>
                    )}
                    {msg.role === 'user' && <MessageStatusIndicator status={msg.status} />}
                    <span className="text-[9px] text-muted-foreground/50 flex-shrink-0" title={msg.timestamp.toLocaleString(locale)}>
                        {formatMessageTimestamp(msg.timestamp, locale)}
                    </span>
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
export default function AgentChat({
    variant = 'full',
    contextGroupId = null,
    contextImageIndex = 0,
    contextImageCount = 0,
    contextSpecies = '',
    className,
    chatId: externalChatId = null,
    resetToken = 0,
    onChatIdChange,
    initialMessages = [],
    onMessagesChange,
    onNewConversationCreated,
}: AgentChatProps) {
    const { user } = useAuth();
    const { t, locale, speechCode } = useLanguage();
    const isCompact = variant === 'compact';

    const [messages, setMessages] = useState<Message[]>(initialMessages);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const [chatId, setChatId] = useState<string | null>(externalChatId);
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [isLoadingOlderHistory, setIsLoadingOlderHistory] = useState(false);
    const [historyCursor, setHistoryCursor] = useState<string | null>(null);
    const [hasMoreHistory, setHasMoreHistory] = useState(false);

    const [playingMsgId, setPlayingMsgId] = useState<string | null>(null);
    const [synthesizingMsgId, setSynthesizingMsgId] = useState<string | null>(null);
    const isSynthesizingRef = useRef(false);
    const audioMapRef = useRef<Record<string, HTMLAudioElement>>({});

    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const shouldAutoScrollRef = useRef(true);
    const historyRequestIdRef = useRef(0);

    // ── Notify parent when messages change ──────────────────────────────────────
    useEffect(() => {
        if (onMessagesChange) {
            onMessagesChange(messages);
        }
    }, [messages, onMessagesChange]);

    // ── Load Chat History when externalChatId changes ───────────────────────────
    useEffect(() => {
        if (externalChatId) {
            const requestId = ++historyRequestIdRef.current;
            setChatId(externalChatId);
            setReplyingTo(null);
            setIsLoadingHistory(true);
            getConversationMessagesPage(30, externalChatId)
                .then((page) => {
                    if (historyRequestIdRef.current !== requestId) return;
                    setMessages(page.messages.map(m => ({
                        id: m.id,
                        role: m.role as 'user' | 'assistant',
                        content: m.text,
                        timestamp: new Date(m.timestamp),
                        status: 'sent',
                    })));
                    setHistoryCursor(page.nextCursor ?? null);
                    setHasMoreHistory(page.hasMore);
                })
                .catch(console.error)
                .finally(() => {
                    if (historyRequestIdRef.current === requestId) {
                        setIsLoadingHistory(false);
                    }
                });
        } else {
            historyRequestIdRef.current += 1;
            setChatId(null);
            setMessages(initialMessages);
            setReplyingTo(null);
            setHistoryCursor(null);
            setHasMoreHistory(false);
            setIsLoadingHistory(false);
        }
    }, [externalChatId]);

    // ── Explicit reset for New Chat even when chatId remains null ───────────────
    useEffect(() => {
        if (resetToken <= 0) return;
        historyRequestIdRef.current += 1;
        setChatId(null);
        setMessages([]);
        setInput("");
        setReplyingTo(null);
        setHistoryCursor(null);
        setHasMoreHistory(false);
        setIsLoadingHistory(false);
    }, [resetToken]);

    const loadOlderHistory = useCallback(async () => {
        if (!externalChatId || !historyCursor || isLoadingOlderHistory) return;

        setIsLoadingOlderHistory(true);
        const container = scrollAreaRef.current;
        const previousScrollHeight = container?.scrollHeight ?? 0;
        const previousScrollTop = container?.scrollTop ?? 0;

        try {
            const page = await getConversationMessagesPage(30, externalChatId, historyCursor);
            const olderMessages: Message[] = page.messages.map(m => ({
                id: m.id,
                role: m.role as 'user' | 'assistant',
                content: m.text,
                timestamp: new Date(m.timestamp),
                status: 'sent',
            }));

            setMessages(prev => {
                const existingIds = new Set(prev.map(m => m.id));
                const uniqueOlder = olderMessages.filter(m => !existingIds.has(m.id));
                return [...uniqueOlder, ...prev];
            });

            setHistoryCursor(page.nextCursor ?? null);
            setHasMoreHistory(page.hasMore);

            requestAnimationFrame(() => {
                if (!container) return;
                const newScrollHeight = container.scrollHeight;
                const heightDelta = newScrollHeight - previousScrollHeight;
                container.scrollTop = previousScrollTop + heightDelta;
            });
        } catch (e) {
            console.error("Failed to load older history", e);
        } finally {
            setIsLoadingOlderHistory(false);
        }
    }, [externalChatId, historyCursor, isLoadingOlderHistory]);

    useEffect(() => {
        (window as any).dispatchReply = (msg: Message) => {
            setReplyingTo(msg);
            inputRef.current?.focus();
        };
        return () => {
            delete (window as any).dispatchReply;
        };
    }, []);

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

    // ── Context Welcome message ──────────────────────────────────────────────────────
    useEffect(() => {
        if (messages.length === 0 && contextGroupId) {
            const welcomeContent = `I've analyzed your catch${contextImageCount > 1 ? ` (${contextImageCount} images)` : ''}. ${contextSpecies ? `I can see **${contextSpecies}** in this image.` : ''} Ask me anything about your fish — species details, market value, sustainability, health status, or cooking tips!`;
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
            setSynthesizingMsgId(msg.id);
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
            setSynthesizingMsgId(null);
        }
    };

    // ── Voice input ───────────────────────────────────────────────────────────
    const { isListening, transcript, isSupported: voiceSupported, startListening, stopListening } = useVoiceInput({
        lang: speechCode, onResult: (t) => setInput(t), onError: (e) => toast.error(e),
    });
    useEffect(() => { if (isListening && transcript) setInput(transcript); }, [transcript, isListening]);

    // Keep textarea height in sync even when input value is set programmatically.
    useEffect(() => {
        const el = inputRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }, [input]);

    // ── Auto scroll ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (shouldAutoScrollRef.current) {
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isTyping]);

    // ── Detect manual scroll to disable auto-scroll ─────────────────────────
    useEffect(() => {
        const container = scrollAreaRef.current;
        if (!container) return;

        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = container;
            const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
            shouldAutoScrollRef.current = isNearBottom;
        };

        container.addEventListener('scroll', handleScroll);
        return () => container.removeEventListener('scroll', handleScroll);
    }, []);

    // ── Send ──────────────────────────────────────────────────────────────────
    const handleSend = useCallback(async (messageText?: string) => {
        const rawText = (messageText ?? input).trim();
        if (!rawText || isTyping) return;

        // Inject context about the current image if available
        let text = rawText;
        if (contextGroupId) {
            text = `[group:${contextGroupId}] [image:${contextImageIndex + 1}/${contextImageCount}] ${rawText}`;
        }

        const userMessageId = `user_${Date.now()}`;
        const userMessage: Message = {
            id: userMessageId,
            role: 'user',
            content: rawText,
            timestamp: new Date(),
            status: 'sending',
            replyTo: replyingTo ? replyingTo.content.substring(0, 100) : undefined
        };
        setMessages(prev => [...prev, userMessage]);

        // Include reply context in prompt
        if (replyingTo) {
            text = `[Replying to: "${replyingTo.content.substring(0, 200)}..."]\n\n${text}`;
        }

        setInput("");
        setReplyingTo(null);
        setIsTyping(true);

        try {
            let targetChatId = chatId;
            if (!targetChatId) {
                try {
                    const newConv = await createConversation(rawText.substring(0, 40), locale);
                    targetChatId = newConv.conversationId;
                    setChatId(targetChatId);
                    if (onNewConversationCreated) onNewConversationCreated(newConv);
                } catch (e) { console.error("Failed to create conversation", e); }
            }

            const tempAiMsgId = `ai_temp_${Date.now()}`;

            // Mark user message as sent
            setMessages(prev => prev.map(m =>
                m.id === userMessageId ? { ...m, status: 'sent' as MessageStatus } : m
            ));

            setMessages(prev => [...prev, {
                id: tempAiMsgId, role: 'assistant', content: '', timestamp: new Date()
            }]);

            let chunkBuffer = "";
            let flushTimer: number | null = null;
            const flushChunkBuffer = () => {
                if (!chunkBuffer) return;
                const pending = chunkBuffer;
                chunkBuffer = "";
                setMessages(prev => prev.map(m =>
                    m.id === tempAiMsgId ? { ...m, content: m.content + pending } : m
                ));
            };
            const enqueueChunk = (chunkText: string) => {
                chunkBuffer += chunkText;
                if (flushTimer !== null) return;
                flushTimer = window.setTimeout(() => {
                    flushTimer = null;
                    flushChunkBuffer();
                }, 24);
            };

            const res = await streamChat(text, enqueueChunk, targetChatId ?? undefined, locale, userLocation ?? undefined);
            if (flushTimer !== null) {
                window.clearTimeout(flushTimer);
                flushTimer = null;
            }
            flushChunkBuffer();

            const finalChatId = targetChatId ?? res.chatId;
            if (finalChatId && !finalChatId.startsWith('demo_')) {
                setChatId(finalChatId);
                if (externalChatId !== finalChatId) {
                    onChatIdChange?.(finalChatId);
                }
            }

            // Always replace temp ID so Listen/Reply buttons appear and markdown renders
            const finalMsgId = res.messageId || `msg_${Date.now()}`;
            setMessages(prev => prev.map(m =>
                m.id === tempAiMsgId ? { ...m, id: finalMsgId } : m
            ));
        } catch (err) {
            console.error("Chat error:", err);

            // Mark user message as failed
            setMessages(prev => prev.map(m =>
                m.id === userMessageId ? { ...m, status: 'failed' as MessageStatus } : m
            ));

            setMessages(prev => [...prev, {
                id: `err_${Date.now()}`,
                role: 'assistant',
                content: "Sorry, I couldn't process that. Please try again.",
                timestamp: new Date(),
            }]);
        } finally {
            setIsTyping(false);
        }
    }, [input, isTyping, chatId, contextGroupId, contextImageIndex, contextImageCount, locale, userLocation, onChatIdChange, externalChatId, onNewConversationCreated, replyingTo]);

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

    const hasPendingAssistantSkeleton = messages.some(
        (m) => m.role === 'assistant' && m.id.startsWith('ai_temp_') && !m.content.trim(),
    );

    const replyPreview = replyingTo
        ? (replyingTo.content.length > 180
            ? `${replyingTo.content.slice(0, 180)}...`
            : replyingTo.content)
        : "";

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
                    <div className="ml-auto flex items-center gap-1.5 text-[10px] text-primary/70 font-medium opacity-0">
                        {/* Reserved space for layout consistency */}
                    </div>
                )}
            </div>

            {/* ── Messages ── */}
            <div className={cn(
                "flex-1 overflow-y-auto py-2 px-5 sm:px-10 lg:px-14",
                isCompact ? "sm:px-6" : ""
            )} ref={scrollAreaRef}>
                <div className={cn("space-y-1 pb-1 mx-auto", isCompact ? "" : "max-w-2xl")}>
                    {hasMoreHistory && !isLoadingHistory && (
                        <div className="flex justify-center pb-1">
                            <button
                                onClick={loadOlderHistory}
                                disabled={isLoadingOlderHistory}
                                className="text-[11px] px-3 py-1 rounded-full border border-border/30 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors disabled:opacity-50"
                            >
                                {isLoadingOlderHistory ? "Loading older messages..." : "Load older messages"}
                            </button>
                        </div>
                    )}
                    {isLoadingHistory && (
                        <div className="flex justify-center py-6">
                            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/50" />
                        </div>
                    )}
                    {!isLoadingHistory && messages.map((msg) => (
                        <MessageRow
                            key={msg.id}
                            message={msg}
                            isCompact={isCompact}
                            isStreaming={isTyping && msg.id.startsWith('ai_temp_')}
                            playingMsgId={playingMsgId}
                            synthesizingMsgId={synthesizingMsgId}
                            onPlayPause={handlePlayPause}
                        />
                    ))}

                    {/* ── Capability Cards (Empty State) ── */}
                    <AnimatePresence>
                        {messages.length === 0 && !contextGroupId && (
                            <motion.div
                                initial={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.3, ease: 'easeOut' }}
                            >
                                <CapabilityCards
                                    onCardClick={(command) => {
                                        // Trigger the command as if user typed it
                                        handleSend(command);
                                    }}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* ── Typing Indicator ── */}
                    {isTyping && !hasPendingAssistantSkeleton && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex gap-3 sm:gap-4 w-full justify-start pt-2"
                        >
                            <Avatar className={cn("shrink-0 border border-primary/20", isCompact ? "h-7 w-7 mt-0.5" : "h-8 w-8 mt-1")}>
                                <div className="bg-primary/10 h-full w-full flex items-center justify-center">
                                    <Bot className={cn(isCompact ? "w-3.5 h-3.5" : "w-4 h-4", "text-primary")} />
                                </div>
                            </Avatar>
                            <div className="py-2.5 px-4 bg-muted/30 border border-border/10 rounded-2xl rounded-tl-md flex items-center h-[38px]">
                                <div className="flex gap-1.5 items-center">
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '0ms', animationDuration: '1s' }} />
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '150ms', animationDuration: '1s' }} />
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary/80 animate-bounce" style={{ animationDelay: '300ms', animationDuration: '1s' }} />
                                </div>
                            </div>
                        </motion.div>
                    )}

                    <div ref={bottomRef} />
                </div>
            </div>

            {/* ── Quick chips ── */}
            {messages.length === 0 && (
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
            {
                isListening && (
                    <div className="px-3 py-2 border-t border-red-500/10 bg-red-500/3 flex items-center gap-2 animate-fade-in shrink-0">
                        <div className="relative flex items-center justify-center">
                            <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
                            <div className="absolute w-4 h-4 bg-red-400/15 rounded-full animate-ping" />
                        </div>
                        <span className="text-xs font-medium text-red-400">Listening...</span>
                        <span className="text-[10px] text-muted-foreground/50 ml-auto">Tap mic to stop</span>
                    </div>
                )
            }

            {/* ── Input bar ── */}
            <div className={cn(
                "border-t border-border/15 bg-background/20 shrink-0",
                isCompact ? "p-2" : "p-2.5"
            )}>
                {replyingTo && (
                    <div className="mb-2 rounded-lg border border-border/30 bg-muted/25 px-3 py-2 text-xs">
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1 border-l-2 border-primary/35 pl-2.5">
                                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-primary/80 font-semibold">
                                    <Reply className="w-3 h-3" />
                                    Replying to {replyingTo.role === 'assistant' ? 'assistant' : 'message'}
                                </div>
                                <p
                                    className="mt-1 text-muted-foreground leading-5 overflow-hidden"
                                    style={{
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                    }}
                                    title={replyingTo.content}
                                >
                                    {replyPreview}
                                </p>
                            </div>
                            <button onClick={() => setReplyingTo(null)} className="text-muted-foreground/60 hover:text-foreground shrink-0">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                )}
                <div className="flex items-center gap-1.5 position-relative z-20 mx-auto w-full max-w-3xl">

                    <Textarea
                        ref={inputRef}
                        value={input}
                        rows={1}
                        onChange={e => {
                            setInput(e.target.value);
                            const el = e.currentTarget;
                            el.style.height = 'auto';
                            el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
                        }}
                        onKeyDown={(e) => {
                            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                                e.preventDefault();
                                handleSend();
                                return;
                            }
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        placeholder={contextGroupId ? "Ask about this catch..." : t('chat.placeholder')}
                        disabled={isTyping}
                        className={cn(
                            "flex-1 min-h-[42px] max-h-40 resize-none py-2.5 pl-3 pr-3 rounded-xl bg-background/70 border border-border/40 focus-visible:ring-1 focus-visible:ring-primary/25 focus-visible:border-primary/30 leading-5",
                            isCompact ? "text-[12.5px]" : "text-[13px]"
                        )}
                    />
                    <button
                        onClick={() => { if (!voiceSupported) { toast.error(t('voice.notSupported')); return; } isListening ? stopListening() : startListening(); }}
                        disabled={isTyping}
                        className={cn(
                            "shrink-0 rounded-xl flex items-center justify-center transition-all",
                            isCompact ? "w-7 h-7" : "w-8 h-8",
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
                            isCompact ? "w-7 h-7" : "w-8 h-8"
                        )}
                    >
                        {isTyping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    </button>
                </div>
            </div>
        </div >
    );
}
