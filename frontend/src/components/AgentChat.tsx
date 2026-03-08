"use client"

import React, { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    Send, Mic, Bot, Volume2, Pause, Fish,
    Loader2, ImageIcon, Sparkles, Check, CheckCheck, AlertCircle,
    MapPin, Upload, BarChart3, X, Reply, Wrench
} from 'lucide-react';
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { streamChat, createConversation, synthesizeSpeech, getConversationMessagesPage, type GroupRecord, type Conversation, type StreamChatUi } from "@/lib/api-client";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/i18n";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { formatMessageTimestamp } from "@/lib/utils/timestamp";
import { useAgentFirstStore } from '@/lib/stores/agent-first-store';
import { useAgentContext } from '@/lib/stores/agent-context-store';
import CapabilityCards from '@/components/agent/CapabilityCards';
import ContextPill from '@/components/agent/ContextPill';
import { AnimatePresence, motion } from 'framer-motion';

// Lazy-load inline widgets (rendered inside chat bubbles)
const InlineMiniMap = lazy(() => import('@/components/agent/InlineMiniMap'));
const InlineHistoryCarousel = lazy(() => import('@/components/agent/InlineHistoryCarousel'));
const InlineUploadZone = lazy(() => import('@/components/agent/InlineUploadZone'));

// ── Types ──────────────────────────────────────────────────────────────────
type MessageStatus = 'sending' | 'sent' | 'failed';

interface MessageWidget {
    type: 'map' | 'history' | 'upload';
    mapLat?: number;
    mapLon?: number;
}

interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    status?: MessageStatus;
    isPaneMessage?: boolean; // Flag to indicate message from ContentCanvas component
    paneSource?: 'upload' | 'map' | 'analytics' | 'history'; // Source component for PaneMessage
    replyTo?: string; // Add reply context
    replyToId?: string;
    widget?: MessageWidget; // Interactive inline widget from agent UI directive
    locationContext?: { lat: number; lon: number }; // Extracted map pin for clickable chip
}

function parseStoredUserMessage(rawText: string): { content: string; replyTo?: string; replyToId?: string; locationContext?: { lat: number; lon: number } } {
    // Stored user prompts may contain transport metadata used for model context.
    let content = rawText ?? '';
    let replyTo: string | undefined;
    let replyToId: string | undefined;
    let locationContext: { lat: number; lon: number } | undefined;

    const replyPrefixWithId = content.match(/^\[Replying to id:([^\s\]]+)\s+text:\s*"([\s\S]*?)"\]\s*\n\n([\s\S]*)$/);
    if (replyPrefixWithId) {
        replyToId = replyPrefixWithId[1]?.trim();
        replyTo = replyPrefixWithId[2]?.trim();
        content = replyPrefixWithId[3] ?? '';
    }

    const replyPrefix = content.match(/^\[Replying to:\s*"([\s\S]*?)"\]\s*\n\n([\s\S]*)$/);
    if (!replyTo && replyPrefix) {
        replyTo = replyPrefix[1]?.trim();
        content = replyPrefix[2] ?? '';
    }

    // Extract mapPin location before stripping context tags
    const mapPinMatch = content.match(/\[mapPin:([\d.\-]+),([\d.\-]+)\]/);
    if (mapPinMatch) {
        const lat = parseFloat(mapPinMatch[1]);
        const lon = parseFloat(mapPinMatch[2]);
        if (!isNaN(lat) && !isNaN(lon)) locationContext = { lat, lon };
    }

    // Strip all context bracket tags: [page:...] [mapPin:...] [userLoc:...] [lang:...] [scan:...] etc.
    content = content.replace(/\[(?:page|lang|userLoc|groupId|species|imgIdx|mapPin|mapZoom|scan|offline|group|image):[^\]]*\]\s*/gi, '');
    return { content: content.trim(), replyTo, replyToId, locationContext };
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
    onReplyQuoteClick: (msg: Message) => void;
    registerMessageElement: (id: string, el: HTMLDivElement | null) => void;
    isHighlighted: boolean;
    style?: React.CSSProperties;
}

function MessageRow({ message: msg, isCompact, isStreaming, playingMsgId, synthesizingMsgId, onPlayPause, onReplyQuoteClick, registerMessageElement, isHighlighted, style }: MessageRowProps) {
    const { locale } = useLanguage();
    const replyPreview = msg.replyTo
        ? (msg.replyTo.length > 120 ? `${msg.replyTo.slice(0, 120)}...` : msg.replyTo)
        : null;

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
            ref={(el) => registerMessageElement(msg.id, el)}
            data-message-id={msg.id}
            style={style}
            className={cn(
                "group flex gap-2.5 sm:gap-3 animate-fade-in-up w-full px-2 py-0.5",
                isHighlighted && "rounded-xl bg-primary/8 ring-1 ring-primary/35 transition-all duration-300",
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

                {/* Location chip — clickable, opens map at these coordinates */}
                {msg.role === 'user' && msg.locationContext && (
                    <button
                        onClick={() => {
                            useAgentFirstStore.getState().setActiveComponent('map', {
                                flyToLocation: { lat: msg.locationContext!.lat, lon: msg.locationContext!.lon, _t: Date.now() },
                            });
                        }}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[10px] text-cyan-600 dark:text-cyan-400 font-semibold hover:bg-cyan-500/20 transition-colors cursor-pointer"
                    >
                        <MapPin className="w-3 h-3" />
                        {msg.locationContext.lat.toFixed(4)}°N, {msg.locationContext.lon.toFixed(4)}°E
                    </button>
                )}

                <div className={cn(
                    "leading-relaxed break-words",
                    msg.role === 'user'
                        ? "rounded-2xl rounded-tr-md bg-primary text-primary-foreground shadow-md px-3.5 py-2 text-[13px] sm:text-[14px] font-medium max-w-[85%]"
                        : "py-0.5 w-full max-w-full sm:max-w-prose"
                )}>
                    {replyPreview && (
                        <button
                            type="button"
                            onClick={() => onReplyQuoteClick(msg)}
                            className={cn(
                                "mb-1.5 rounded-md border-l-2 px-2 py-1 text-[11px] leading-4",
                                "w-full text-left transition-colors hover:opacity-95",
                                msg.role === 'user'
                                    ? "border-white/60 bg-white/15 text-primary-foreground/90"
                                    : "border-primary/35 bg-primary/5 text-muted-foreground"
                            )}
                            title="Jump to replied message"
                        >
                            <div className={cn(
                                "mb-0.5 text-[10px] font-semibold uppercase tracking-wide",
                                msg.role === 'user' ? "text-primary-foreground/80" : "text-primary/80"
                            )}>
                                Replying to
                            </div>
                            {replyPreview}
                        </button>
                    )}
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

                {/* ── Inline Widget (map / history / upload) ── */}
                {msg.role === 'assistant' && msg.widget && !isStreaming && (
                    <Suspense fallback={<div className="h-16 rounded-xl bg-muted/20 animate-pulse mt-1" />}>
                        {msg.widget.type === 'map' && msg.widget.mapLat != null && msg.widget.mapLon != null && (
                            <InlineMiniMap lat={msg.widget.mapLat} lon={msg.widget.mapLon} />
                        )}
                        {msg.widget.type === 'history' && (
                            <InlineHistoryCarousel
                                onAskAboutGroup={(groupId, summary) => {
                                    (window as any).__agentChatInject?.(`Summarize and analyze catch group ${groupId}: ${summary}`);
                                }}
                            />
                        )}
                        {msg.widget.type === 'upload' && (
                            <InlineUploadZone />
                        )}
                    </Suspense>
                )}

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
    const messageElementsRef = useRef<Record<string, HTMLDivElement | null>>({});

    // ── Tool activity tracking (shows which tool the agent is calling) ──────
    const [activeToolName, setActiveToolName] = useState<string | null>(null);

    // ── Agent context store integration ──────────────────────────────────────
    const agentContextPayload = useAgentContext(s => s.buildContextPayload);

    // Expose a global injection helper so inline widgets can inject prompts
    useEffect(() => {
        (window as any).__agentChatInject = (text: string) => {
            setInput(text);
            inputRef.current?.focus();
        };
        return () => { delete (window as any).__agentChatInject; };
    }, []);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const shouldAutoScrollRef = useRef(true);
    const historyRequestIdRef = useRef(0);
    const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

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
                        ...(m.role === 'user' ? parseStoredUserMessage(m.text) : { content: m.text }),
                        id: m.id,
                        role: m.role as 'user' | 'assistant',
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
                ...(m.role === 'user' ? parseStoredUserMessage(m.text) : { content: m.text }),
                id: m.id,
                role: m.role as 'user' | 'assistant',
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

    const registerMessageElement = useCallback((id: string, el: HTMLDivElement | null) => {
        if (el) messageElementsRef.current[id] = el;
        else delete messageElementsRef.current[id];
    }, []);

    const handleReplyQuoteClick = useCallback((msg: Message) => {
        let targetId = msg.replyToId;

        if (!targetId && msg.replyTo) {
            const needle = msg.replyTo.trim().toLowerCase();
            const found = messages.find((m) => {
                if (m.id === msg.id) return false;
                const text = m.content.trim().toLowerCase();
                return text.startsWith(needle) || needle.startsWith(text.slice(0, Math.min(40, text.length)));
            });
            targetId = found?.id;
        }

        if (!targetId) {
            toast.error('Original replied message was not found');
            return;
        }

        const targetEl = messageElementsRef.current[targetId];
        if (!targetEl) {
            toast.error('Original replied message is not visible in this chat window');
            return;
        }

        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightedMessageId(targetId);
        window.setTimeout(() => {
            setHighlightedMessageId((current) => (current === targetId ? null : current));
        }, 1400);
    }, [messages]);

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
            window.speechSynthesis?.cancel();
            setPlayingMsgId(null);
            return;
        }
        if (playingMsgId && audioMapRef.current[playingMsgId]) {
            audioMapRef.current[playingMsgId].pause();
        }
        window.speechSynthesis?.cancel();
        if (audioMapRef.current[msg.id]) {
            setPlayingMsgId(msg.id);
            audioMapRef.current[msg.id].play().catch(console.error);
            return;
        }
        if (isSynthesizingRef.current) return;

        // Helper: browser-native TTS fallback
        const fallbackBrowserTTS = () => {
            if (!window.speechSynthesis) {
                toast.error('Speech not available on this device.');
                return;
            }
            const utterance = new SpeechSynthesisUtterance(msg.content.substring(0, 1000));
            utterance.lang = speechCode || 'en-IN';
            utterance.rate = 0.9;
            setPlayingMsgId(msg.id);
            utterance.onend = () => setPlayingMsgId(prev => prev === msg.id ? null : prev);
            utterance.onerror = () => setPlayingMsgId(null);
            window.speechSynthesis.speak(utterance);
        };

        try {
            isSynthesizingRef.current = true;
            setSynthesizingMsgId(msg.id);
            const res = await synthesizeSpeech(msg.content, speechCode || 'en-IN');
            // Backend signals this language has no Polly voice — use browser TTS
            if ((res as any).useBrowserTTS || !res.audioBase64) {
                fallbackBrowserTTS();
                return;
            }
            const audio = new Audio(`data:audio/mp3;base64,${res.audioBase64}`);
            audioMapRef.current[msg.id] = audio;
            setPlayingMsgId(msg.id);
            audio.play().catch(console.error);
            audio.onended = () => setPlayingMsgId(prev => prev === msg.id ? null : prev);
        } catch {
            // Polly failed (500 / credentials) — fall back to browser speech
            console.warn('[TTS] Polly failed, using browser speechSynthesis fallback');
            fallbackBrowserTTS();
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
        // Prepend global agent context (page, location, selection etc.)
        const ctxPayload = agentContextPayload();
        if (ctxPayload) {
            text = `${ctxPayload} ${text}`;
        }

        const userMessageId = `user_${Date.now()}`;
        // Attach location context from the current agent context (if a map pin is selected)
        const currentMapPin = useAgentContext.getState().selectedMapPoint ?? undefined;
        const userMessage: Message = {
            id: userMessageId,
            role: 'user',
            content: rawText,
            timestamp: new Date(),
            status: 'sending',
            replyTo: replyingTo ? replyingTo.content.substring(0, 100) : undefined,
            replyToId: replyingTo?.id,
            locationContext: currentMapPin,
        };
        setMessages(prev => [...prev, userMessage]);

        // Include reply context in prompt
        if (replyingTo) {
            text = `[Replying to id:${replyingTo.id} text:"${replyingTo.content.substring(0, 200)}..."]\n\n${text}`;
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

            const res = await streamChat(
                text,
                enqueueChunk,
                targetChatId ?? undefined,
                locale,
                userLocation ?? undefined,
                (toolName) => setActiveToolName(toolName),
            );
            if (flushTimer !== null) {
                window.clearTimeout(flushTimer);
                flushTimer = null;
            }
            flushChunkBuffer();
            setActiveToolName(null);

            const finalChatId = targetChatId ?? res.chatId;
            if (finalChatId && !finalChatId.startsWith('demo_')) {
                setChatId(finalChatId);
                if (externalChatId !== finalChatId) {
                    onChatIdChange?.(finalChatId);
                }
            }

            // Determine widget from agent UI directive
            let widget: MessageWidget | undefined;
            if (res.ui) {
                if (res.ui.map && res.ui.mapLat != null && res.ui.mapLon != null) {
                    widget = { type: 'map', mapLat: res.ui.mapLat, mapLon: res.ui.mapLon };
                } else if (res.ui.history) {
                    widget = { type: 'history' };
                } else if (res.ui.upload) {
                    widget = { type: 'upload' };
                }
            }

            // Always replace temp ID so Listen/Reply buttons appear and markdown renders
            const finalMsgId = res.messageId || `msg_${Date.now()}`;
            setMessages(prev => prev.map(m =>
                m.id === tempAiMsgId ? { ...m, id: finalMsgId, widget } : m
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
            setActiveToolName(null);
        }
    }, [input, isTyping, chatId, contextGroupId, contextImageIndex, contextImageCount, locale, userLocation, onChatIdChange, externalChatId, onNewConversationCreated, replyingTo, agentContextPayload]);

    // ── Quick action chips for compact mode ──────────────────────────────────
    const quickChips = contextGroupId ? [
        t('chat.chip.tellAbout'),
        t('chat.chip.marketValue'),
        t('chat.chip.healthy'),
        t('chat.chip.cooking'),
        t('chat.chip.sustainability'),
    ] : [
        t('chat.chip.identify'),
        t('chat.chip.seaConditions'),
        t('chat.chip.regulations'),
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
            "flex flex-col bg-card/30 backdrop-blur-sm rounded-2xl border border-border/20 overflow-hidden relative",
            isCompact ? "h-full" : "h-[calc(100dvh-185px)] sm:h-[calc(100dvh-210px)] lg:h-[calc(100dvh-140px)]",
            !isCompact && "mx-auto w-full max-w-[1200px] 2xl:max-w-[1280px]",
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
                        {activeToolName ? (
                            <>
                                <Wrench className="w-3 h-3 animate-spin" />
                                <span className="truncate max-w-[120px]">{activeToolName}</span>
                            </>
                        ) : (
                            <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>Thinking…</span>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* ── Messages ── */}
            <div className={cn(
                "flex-1 overflow-y-auto py-2 relative",
                isCompact ? "px-5 sm:px-6" : "px-4 sm:px-8 lg:px-12 xl:px-16 2xl:px-20"
            )} ref={scrollAreaRef}>
                <div className={cn("space-y-1 pb-1 mx-auto w-full", isCompact ? "max-w-4xl" : "max-w-2xl")}>
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
                            onReplyQuoteClick={handleReplyQuoteClick}
                            registerMessageElement={registerMessageElement}
                            isHighlighted={highlightedMessageId === msg.id}
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
                        <span className="text-[10px] text-muted-foreground/50 ml-auto">Release to send</span>
                    </div>
                )
            }

            {/* ── Input bar ── */}
            <div className={cn(
                "border-t border-border/15 bg-background/20 shrink-0",
                isCompact ? "p-2" : "p-2.5"
            )}>
                {replyingTo && (
                    <div className={cn(
                        "mb-2 mx-auto w-full rounded-lg border border-border/30 bg-muted/20 px-3 py-1.5 text-xs",
                        isCompact ? "max-w-3xl" : "max-w-3xl"
                    )}>
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1 border-l-2 border-primary/35 pl-2.5">
                                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-primary/80 font-semibold">
                                    <Reply className="w-3 h-3" />
                                    Replying to {replyingTo.role === 'assistant' ? 'assistant' : 'message'}
                                </div>
                                <div className="relative mt-1">
                                    <p
                                        className="text-muted-foreground leading-5 overflow-hidden pr-8"
                                        style={{
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical',
                                        }}
                                        title={replyingTo.content}
                                    >
                                        {replyPreview}
                                    </p>
                                    <span className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-muted/20 to-transparent" />
                                </div>
                            </div>
                            <button onClick={() => setReplyingTo(null)} className="text-muted-foreground/60 hover:text-foreground shrink-0">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                )}
                <div className={cn(
                    "flex flex-col gap-1.5 mx-auto w-full",
                    isCompact ? "max-w-3xl" : "max-w-3xl"
                )}>
                    {/* Context Pill — shows what context the AI is "seeing" */}
                    <div className="flex items-center gap-1.5 px-0.5">
                        <ContextPill />
                        {isCompact && (
                            <span className="text-[9px] text-muted-foreground/40 ml-auto hidden sm:block">Ctrl+K for commands</span>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5">

                    <Textarea
                        ref={inputRef}
                        value={input}
                        rows={2}
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
                            "flex-1 min-h-[56px] max-h-44 resize-none py-3 pl-3.5 pr-3.5 rounded-xl bg-background/70 border border-border/40 focus-visible:ring-1 focus-visible:ring-primary/25 focus-visible:border-primary/30 leading-5",
                            isCompact ? "text-[12.5px]" : "text-[13px]"
                        )}
                    />
                    <button
                        onClick={() => { if (!voiceSupported) { toast.error(t('voice.notSupported')); return; } isListening ? stopListening() : startListening(); }}
                        disabled={isTyping}
                        data-compact
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
                        data-compact
                        className={cn(
                            "shrink-0 rounded-xl bg-primary text-white flex items-center justify-center shadow-sm shadow-primary/15 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed",
                            isCompact ? "w-7 h-7" : "w-8 h-8"
                        )}
                    >
                        {isTyping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    </button>
                    </div>
                </div>
            </div>

            {/* ════════════════════════════════════════════════════════════════════
                HOLD-TO-SPEAK FAB — Large floating mic button (WhatsApp style)
                Visible only on touch devices / mobile
            ════════════════════════════════════════════════════════════════════ */}
            {voiceSupported && (
                <div className="absolute bottom-24 right-4 z-30 md:bottom-28 md:right-6">
                    <div className="relative">
                        {/* Pulsing rings when listening */}
                        {isListening && (
                            <>
                                <div className="absolute inset-0 rounded-full bg-red-500/20 animate-pulse-ring" />
                                <div className="absolute inset-[-8px] rounded-full bg-red-500/10 animate-pulse-ring" style={{ animationDelay: '0.3s' }} />
                            </>
                        )}
                        <button
                            onPointerDown={(e) => {
                                e.preventDefault();
                                if (!isTyping && voiceSupported) startListening();
                            }}
                            onPointerUp={(e) => {
                                e.preventDefault();
                                if (isListening) {
                                    stopListening();
                                    // Auto-send after a brief delay for STT to finalize
                                    setTimeout(() => {
                                        const currentInput = inputRef.current?.value?.trim();
                                        if (currentInput) handleSend(currentInput);
                                    }, 400);
                                }
                            }}
                            onPointerCancel={() => { if (isListening) stopListening(); }}
                            onContextMenu={(e) => e.preventDefault()}
                            disabled={isTyping}
                            className={cn(
                                "w-[72px] h-[72px] rounded-full flex items-center justify-center shadow-2xl transition-all duration-200 select-none touch-none",
                                isListening
                                    ? "bg-red-500 text-white scale-110 shadow-red-500/40"
                                    : "bg-primary text-primary-foreground hover:scale-105 shadow-primary/30 active:scale-95"
                            )}
                            aria-label="Hold to speak"
                        >
                            <Mic className="w-8 h-8" />
                        </button>
                        {!isListening && (
                            <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-muted-foreground whitespace-nowrap">
                                Hold to speak
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div >
    );
}
