"use client"

import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Send, Mic, Bot, Volume2, Pause, Waves, Fish, CloudRain, BookOpen,
  HelpCircle, Plus, Loader2, Download, X, CornerUpLeft, ImageIcon,
  MessageSquare, Clock, ChevronRight, Zap, AlertTriangle, RefreshCw, ExternalLink,
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { sendChat, streamChat, getChatHistory, getConversationsList, createConversation, synthesizeSpeech, getGroups, type GroupRecord } from "@/lib/api-client";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/i18n";
import { useVoiceInput } from "@/hooks/useVoiceInput";

// ── Types ──────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  timestamp: Date;
  failedText?: string; // original user text to retry
}

interface ReplyRef {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────
const parseSafeDate = (dateInput: string | Date | undefined): Date => {
  if (!dateInput) return new Date();
  let d = new Date(dateInput);
  if (isNaN(d.getTime()) && typeof dateInput === 'string')
    d = new Date(dateInput.replace(/\.[0-9a-fA-F]{3}Z$/, '.000Z'));
  return isNaN(d.getTime()) ? new Date() : d;
};
const truncate = (s: string, n = 80) => s.length > n ? s.slice(0, n) + '…' : s;

// ── Skeleton components ────────────────────────────────────────────────────
function MessageSkeleton({ align }: { align: 'left' | 'right' }) {
  return (
    <div className={cn("flex gap-3 max-w-[75%] animate-pulse", align === 'right' ? "ml-auto flex-row-reverse" : "mr-auto")}>
      <Skeleton className="w-9 h-9 rounded-full shrink-0" />
      <div className="space-y-2 flex-1">
        <Skeleton className={cn("h-4 rounded-2xl", align === 'right' ? "w-32 ml-auto" : "w-48")} />
        <Skeleton className={cn("h-10 rounded-2xl", align === 'right' ? "w-40 ml-auto" : "w-64")} />
        <Skeleton className={cn("h-3 w-12 rounded", align === 'right' ? "ml-auto" : "")} />
      </div>
    </div>
  );
}

function ConversationSkeleton() {
  return (
    <div className="space-y-2 px-1 animate-pulse">
      {[80, 65, 90].map((w, i) => (
        <div key={i} className="flex items-center gap-2.5 p-3 rounded-xl bg-muted/20">
          <Skeleton className="w-6 h-6 rounded-lg shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className={`h-3 rounded`} style={{ width: `${w}%` }} />
            <Skeleton className="h-2 w-14 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Markdown renderer config ───────────────────────────────────────────────
const MD_COMPONENTS: React.ComponentProps<typeof ReactMarkdown>['components'] = {
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic text-muted-foreground">{children}</em>,
  ul: ({ children }) => <ul className="my-2 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 space-y-1 list-decimal list-inside">{children}</ol>,
  li: ({ children }) => (
    <li className="flex gap-2 items-start">
      <span className="mt-2 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
      <span>{children}</span>
    </li>
  ),
  code: ({ children }) => <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>,
  hr: () => <hr className="my-3 border-border/40" />,
  h3: ({ children }) => <h3 className="font-bold text-sm mt-3 mb-1">{children}</h3>,
  h4: ({ children }) => <h4 className="font-semibold text-sm mt-2 mb-1 text-muted-foreground">{children}</h4>,
  blockquote: ({ children }) => <blockquote className="border-l-2 border-primary/40 pl-3 my-2 text-muted-foreground italic">{children}</blockquote>,
};

// ═══════════════════════════════════════════════════════════════════════════
export default function ChatbotPage() {
  const { user } = useAuth();
  const { t, locale, speechCode } = useLanguage();

  const [messages, setMessages] = useState<Message[]>([{
    id: 'welcome', role: 'assistant', content: t('chat.welcome'), timestamp: new Date(),
  }]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isLoadingChats, setIsLoadingChats] = useState(true);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [chats, setChats] = useState<{ id: string; title: string; updatedAt?: string }[]>([]);

  const [playingMsgId, setPlayingMsgId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [replyingTo, setReplyingTo] = useState<ReplyRef | null>(null);

  const [showImagePicker, setShowImagePicker] = useState(false);
  const [recentGroups, setRecentGroups] = useState<GroupRecord[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasInitialized = useRef(false);

  // ── Geolocation ──────────────────────────────────────────────────────────
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) => console.warn('Geolocation denied or unavailable:', err.message),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }, []);

  // ── TTS ──────────────────────────────────────────────────────────────────
  const isSynthesizingRef = useRef(false);
  const audioMapRef = useRef<Record<string, HTMLAudioElement>>({});

  const handlePlayPause = async (msg: Message) => {
    // If currently playing this message, pause it
    if (playingMsgId === msg.id) {
      if (audioMapRef.current[msg.id]) {
        audioMapRef.current[msg.id].pause();
      }
      setPlayingMsgId(null);
      return;
    }

    // Pause any other currently playing audio
    if (playingMsgId && audioMapRef.current[playingMsgId]) {
      audioMapRef.current[playingMsgId].pause();
    }

    // If we already synthesized and cached this audio, just resume it
    if (audioMapRef.current[msg.id]) {
      setPlayingMsgId(msg.id);
      audioMapRef.current[msg.id].play().catch(e => console.error("Audio play failed:", e));
      return;
    }

    // Prevent clicking multiple times spawning overlapping fetch requests
    if (isSynthesizingRef.current) return;

    try {
      isSynthesizingRef.current = true;
      const tid = toast.loading('Generating audio…');
      const res = await synthesizeSpeech(msg.content, speechCode || 'en-IN');
      toast.dismiss(tid);

      if (!res.audioBase64) {
        toast.info('Audio not available in demo mode.');
        return;
      }

      const audio = new Audio(`data:audio/mp3;base64,${res.audioBase64}`);
      audioMapRef.current[msg.id] = audio;

      setPlayingMsgId(msg.id);
      audio.play().catch(e => console.error("Audio play failed:", e));

      audio.onended = () => {
        setPlayingMsgId(prev => (prev === msg.id ? null : prev));
      };
    } catch {
      toast.dismiss();
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

  // ── Image picker ──────────────────────────────────────────────────────────
  const openImagePicker = async () => {
    setShowImagePicker(true);
    if (recentGroups.length > 0) return;
    setImagesLoading(true);
    try {
      const { groups } = await getGroups(20);
      setRecentGroups(groups.filter(g => g.status === 'completed'));
    } catch { } finally { setImagesLoading(false); }
  };
  const handleAttachGroup = (group: GroupRecord) => {
    const analysis = group.analysisResult as any;
    const topSpecies = analysis?.summary?.topSpecies || analysis?.topSpecies || 'Unknown';
    setInput(prev => {
      const base = prev.endsWith('@') ? prev.slice(0, -1) : prev;
      return base + (base.length > 0 && !base.endsWith(' ') ? ' ' : '') + `[Ref: ${topSpecies}] (ID: ${group.groupId}) `;
    });
    setShowImagePicker(false); inputRef.current?.focus();
  };

  // ── Quick actions ─────────────────────────────────────────────────────────
  const QUICK_ACTIONS = [
    { label: t('chat.action.fish'), icon: Fish, query: "How do I identify fish species?", color: "text-blue-500 bg-blue-500/10" },
    { label: t('chat.action.weather'), icon: CloudRain, query: "What are the sea conditions today?", color: "text-cyan-500 bg-cyan-500/10" },
    { label: t('chat.action.ocean'), icon: Waves, query: "What are the current ocean conditions?", color: "text-emerald-500 bg-emerald-500/10" },
    { label: t('chat.action.regulations'), icon: BookOpen, query: "What are the fishing regulations?", color: "text-amber-500 bg-amber-500/10" },
    { label: t('chat.action.tips'), icon: HelpCircle, query: "Give me tips to improve my catch quality", color: "text-purple-500 bg-purple-500/10" },
  ];

  // ── Load chat ─────────────────────────────────────────────────────────────
  const loadChat = async (chatId: string) => {
    setCurrentChatId(chatId); setMessages([]); setIsLoadingHistory(true);
    try {
      const history = await getChatHistory(50, chatId);
      const formatted: Message[] = history.map(msg => ({
        id: msg.id, role: msg.role as 'user' | 'assistant',
        content: msg.text, timestamp: parseSafeDate(msg.timestamp),
      }));
      setMessages(formatted.length > 0 ? formatted : [{ id: 'welcome', role: 'assistant', content: t('chat.welcome'), timestamp: new Date() }]);
    } catch { toast.error("Failed to load conversation"); }
    finally { setIsLoadingHistory(false); }
  };

  const createNewChat = () => {
    setCurrentChatId(null); setReplyingTo(null);
    setMessages([{ id: 'welcome', role: 'assistant', content: t('chat.welcome'), timestamp: new Date() }]);
  };

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isTyping]);

  // ── Send ──────────────────────────────────────────────────────────────────
  const handleSend = useCallback(async (messageText?: string, retryId?: string) => {
    const rawText = (messageText ?? input).trim();
    if (!rawText || isTyping) return;

    const text = replyingTo
      ? `[Replying to: "${truncate(replyingTo.content, 60)}"]\n\n${rawText}` : rawText;

    // Remove any existing error bubble for this retry
    if (retryId) setMessages(prev => prev.filter(m => m.id !== retryId));

    const userMsgId = `user_${Date.now()}`;
    const userMessage: Message = { id: userMsgId, role: 'user', content: rawText, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInput(""); setReplyingTo(null); setIsTyping(true);

    try {
      let targetChatId = currentChatId;
      if (!targetChatId) {
        try {
          const newConv = await createConversation(rawText.substring(0, 40), locale);
          targetChatId = newConv.conversationId;
          setCurrentChatId(targetChatId);
          setChats(prev => [{ id: newConv.conversationId, title: rawText.substring(0, 40) }, ...prev]);
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
        setCurrentChatId(res.chatId);
        setChats(prev => [{ id: res.chatId, title: rawText }, ...prev]);
      }

      if (res.messageId) {
        setMessages(prev => prev.map(m =>
          m.id === tempAiMsgId ? { ...m, id: res.messageId! } : m
        ));
      }
    } catch (err) {
      console.error("Chat error:", err);
      // Inline error bubble with retry
      setMessages(prev => [...prev, {
        id: `err_${Date.now()}`,
        role: 'error',
        content: "Message failed to send. Please check your connection and try again.",
        failedText: rawText,
        timestamp: new Date(),
      }]);
    } finally { setIsTyping(false); }
  }, [input, isTyping, currentChatId, replyingTo, locale]);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    const init = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const analysisId = urlParams.get('analysisId');
        const prefill = urlParams.get('prefill');
        const convList = await getConversationsList();
        setChats(convList.map(c => ({ id: c.conversationId, title: c.title, updatedAt: c.updatedAt })));
        setIsLoadingChats(false);

        // Remove params from URL cleanly
        if (analysisId || prefill) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }

        if (analysisId) {
          // Auto-send a structured query about a specific single image
          setIsLoadingHistory(false);
          setTimeout(() => handleSend(`Look up the details of my catch with Image ID: ${analysisId} and provide advice on its market value and sustainability.`), 800);
        } else if (prefill) {
          // Pre-fill the input without auto-sending — let the user review and send
          setInput(decodeURIComponent(prefill));
          setIsLoadingHistory(false);
          setTimeout(() => inputRef.current?.focus(), 300);
        } else if (convList.length > 0) {
          await loadChat(convList[0].conversationId);
        } else { setIsLoadingHistory(false); }
      } catch { setIsLoadingHistory(false); setIsLoadingChats(false); }
    };
    init();
  }, [handleSend]);


  // ── Export ────────────────────────────────────────────────────────────────
  const exportChat = () => {
    const content = messages.filter(m => m.role !== 'error')
      .map(m => `[${m.timestamp.toLocaleString()}] ${m.role === 'user' ? 'You' : 'OceanAI'}: ${m.content}`)
      .join('\n\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `oceanai-chat-${new Date().toISOString().split('T')[0]}.txt`; a.click();
    URL.revokeObjectURL(url); toast.success(t('chat.exported'));
  };

  // ═════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col space-y-4 sm:space-y-6 h-[calc(100dvh-185px)] sm:h-[calc(100dvh-210px)] lg:h-[calc(100dvh-185px)]">

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t('chat.title')}</h1>
          <p className="text-sm sm:text-base text-muted-foreground">{t('chat.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <a
            href="https://t.me/OceanAICompanionBot"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-2 flex-none rounded-xl bg-[#229ED9] hover:bg-[#1a8abf] text-white border-0 h-10 sm:h-11 text-xs sm:text-sm px-4 font-semibold transition-colors shadow-md shadow-[#229ED9]/20"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
            Connect to Telegram
            <ExternalLink className="w-3 h-3 opacity-70" />
          </a>
          <Button variant="outline" className="flex-1 sm:flex-none rounded-xl bg-card border-border h-10 sm:h-11 text-xs sm:text-sm hover:bg-primary/5 hover:text-primary transition-colors" onClick={createNewChat}>
            <Plus className="mr-2 w-4 h-4" /> New Chat
          </Button>
          <Button variant="outline" className="flex-1 sm:flex-none rounded-xl bg-card border-border h-10 sm:h-11 text-xs sm:text-sm" onClick={exportChat}>
            <Download className="mr-2 w-4 h-4" /> {t('chat.exportChat')}
          </Button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 min-h-0">

        {/* ── Main chat area ── */}
        <Card className="lg:col-span-8 rounded-3xl border-border/50 bg-card/50 backdrop-blur-sm flex flex-col h-[500px] sm:h-full overflow-hidden order-1">

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6" ref={scrollAreaRef}>
            <div className="space-y-5 pb-4">
              {isLoadingHistory ? (
                /* ── Message Skeletons ── */
                <>
                  <MessageSkeleton align="left" />
                  <MessageSkeleton align="right" />
                  <MessageSkeleton align="left" />
                  <MessageSkeleton align="right" />
                  <MessageSkeleton align="left" />
                </>
              ) : messages.map((msg) => {

                // ── Error bubble ──────────────────────────────────────────
                if (msg.role === 'error') return (
                  <div key={msg.id} className="mr-auto max-w-[85%] animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex gap-3">
                      <div className="w-9 h-9 rounded-full border-2 border-destructive/30 bg-destructive/10 flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-4 h-4 text-destructive" />
                      </div>
                      <div className="space-y-1 min-w-0">
                        <div className="bg-destructive/8 border border-destructive/20 rounded-2xl rounded-tl-sm p-3 sm:p-4">
                          <div className="flex items-start gap-2.5">
                            <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-destructive mb-0.5">Message failed to send</p>
                              <p className="text-xs text-muted-foreground leading-relaxed">{msg.content}</p>
                              {msg.failedText && (
                                <div className="mt-2 p-2 bg-muted/40 rounded-lg border border-border/40">
                                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-bold mb-1">Your message</p>
                                  <p className="text-xs text-foreground/70 italic truncate">"{truncate(msg.failedText, 60)}"</p>
                                </div>
                              )}
                            </div>
                          </div>
                          {msg.failedText && (
                            <button
                              onClick={() => handleSend(msg.failedText, msg.id)}
                              className="mt-3 w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-destructive/10 hover:bg-destructive/20 border border-destructive/20 text-destructive text-xs font-bold transition-all active:scale-95"
                            >
                              <RefreshCw className="w-3.5 h-3.5" /> Try Again
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-2 px-1">
                          <button onClick={() => setMessages(prev => prev.filter(m => m.id !== msg.id))}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide text-muted-foreground hover:text-destructive transition-colors">
                            <X className="w-3 h-3" /> Dismiss
                          </button>
                          <span className="text-[10px] text-muted-foreground">
                            {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );

                // ── Normal bubble ─────────────────────────────────────────
                return (
                  <div
                    key={msg.id}
                    className={cn(
                      "group flex gap-3 max-w-[90%] sm:max-w-[85%] animate-in fade-in slide-in-from-bottom-2 duration-300",
                      msg.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                    )}
                  >
                    <Avatar className={cn("h-8 w-8 sm:h-9 sm:w-9 shrink-0 border-2", msg.role === 'assistant' ? "border-primary/20" : "border-border/50")}>
                      {msg.role === 'assistant' ? (
                        <div className="bg-primary h-full w-full flex items-center justify-center text-white"><Bot className="w-4 h-4" /></div>
                      ) : (
                        <><AvatarImage src={user?.avatar} /><AvatarFallback className="bg-muted text-xs font-bold">{user?.name?.charAt(0) ?? 'ME'}</AvatarFallback></>
                      )}
                    </Avatar>

                    <div className="space-y-1 min-w-0">
                      <div className={cn(
                        "p-3 sm:p-4 rounded-2xl leading-relaxed text-sm sm:text-[15px] shadow-sm break-words",
                        msg.role === 'assistant'
                          ? "bg-card border border-border/50 text-foreground rounded-tl-sm"
                          : "bg-primary text-white rounded-tr-sm"
                      )}>
                        {msg.role === 'assistant' ? (
                          msg.content ? (
                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
                              {msg.content}
                            </ReactMarkdown>
                          ) : (
                            <div className="flex gap-1.5 items-center h-5 sm:h-6 px-1">
                              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                            </div>
                          )
                        ) : (
                          <span className="whitespace-pre-wrap">{msg.content}</span>
                        )}
                      </div>

                      <div className={cn("flex items-center gap-1.5 px-1", msg.role === 'user' ? "justify-end" : "justify-start")}>
                        {msg.role === 'assistant' && !msg.id.toString().startsWith('ai_temp_') && (<>
                          <button onClick={() => handlePlayPause(msg)}
                            className={cn("flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all",
                              playingMsgId === msg.id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted hover:text-primary")}>
                            {playingMsgId === msg.id ? <><Pause className="w-3 h-3" /> Pause</> : <><Volume2 className="w-3 h-3" /> Listen</>}
                          </button>
                          <button onClick={() => { setReplyingTo(msg as ReplyRef); inputRef.current?.focus(); }}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide text-muted-foreground hover:bg-muted hover:text-primary transition-all">
                            <CornerUpLeft className="w-3 h-3" /> Reply
                          </button>
                        </>)}
                        {msg.role === 'user' && (
                          <button onClick={() => { setReplyingTo(msg as ReplyRef); inputRef.current?.focus(); }}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide text-muted-foreground hover:bg-muted hover:text-primary transition-all opacity-0 group-hover:opacity-100">
                            <CornerUpLeft className="w-3 h-3" /> Reply
                          </button>
                        )}
                        <span className="text-[10px] text-muted-foreground">
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

          {/* Voice indicator */}
          {isListening && (
            <div className="px-4 sm:px-6 py-2.5 border-t border-red-500/20 bg-red-500/5 flex items-center gap-3 animate-in fade-in duration-200">
              <div className="relative flex items-center justify-center">
                <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                <div className="absolute w-5 h-5 bg-red-500/20 rounded-full animate-ping" />
              </div>
              <span className="text-sm font-semibold text-red-500">{t('voice.listening')}</span>
              <span className="text-xs text-muted-foreground ml-auto">{t('voice.tapToStop')}</span>
            </div>
          )}

          {/* Reply bar */}
          {replyingTo && (
            <div className="px-4 sm:px-5 py-2.5 border-t border-primary/20 bg-primary/5 flex items-start gap-3 animate-in slide-in-from-bottom-2 duration-200">
              <CornerUpLeft className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-0.5">
                  Replying to {replyingTo.role === 'assistant' ? 'OceanAI' : 'yourself'}
                </p>
                <p className="text-xs text-muted-foreground truncate">{truncate(replyingTo.content)}</p>
              </div>
              <button onClick={() => setReplyingTo(null)} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Image picker */}
          {showImagePicker && (
            <div className="border-t border-border/50 bg-card/80 backdrop-blur-sm p-4 animate-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <ImageIcon className="w-3.5 h-3.5" /> Reference a Catch Analysis
                </p>
                <button onClick={() => setShowImagePicker(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {imagesLoading ? (
                <div className="grid grid-cols-6 gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="aspect-square rounded-xl" />
                  ))}
                </div>
              ) : recentGroups.length === 0 ? (
                <p className="text-xs text-muted-foreground italic text-center py-4">No completed analyses yet. Upload a fish photo first!</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 max-h-36 overflow-y-auto">
                  {recentGroups.map(group => {
                    const analysis = group.analysisResult as any;
                    const species = analysis?.summary?.topSpecies || analysis?.topSpecies || 'Unknown';
                    const dateObj = new Date(group.createdAt);
                    const dateStr = isNaN(dateObj.getTime()) ? '' : `${dateObj.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} ${dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
                    return (
                      <button key={group.groupId} onClick={() => handleAttachGroup(group)}
                        className="group relative rounded-xl overflow-hidden border-2 border-transparent hover:border-primary transition-all aspect-square bg-muted/30" title={`${species} — ${dateStr}`}>
                        <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-1">
                          <Fish className="w-5 h-5 text-primary/60 group-hover:text-primary transition-colors" />
                          <span className="text-[9px] font-medium text-muted-foreground text-center leading-tight line-clamp-1">{species}</span>
                          <span className="text-[8px] text-muted-foreground/60 text-center leading-tight">{dateStr}</span>
                          <span className="text-[8px] text-muted-foreground/60">{group.imageCount} 🖼</span>
                        </div>
                        <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Input bar */}
          <div className="p-3 sm:p-4 border-t border-border/50 bg-background/30">
            <div className="flex items-center gap-2">
              <button onClick={showImagePicker ? () => setShowImagePicker(false) : openImagePicker}
                className={cn("shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                  showImagePicker ? "bg-primary text-white" : "bg-muted/50 text-muted-foreground hover:bg-primary/10 hover:text-primary")}>
                <ImageIcon className="w-4 h-4" />
              </button>
              <Input ref={inputRef} value={input}
                onChange={e => {
                  setInput(e.target.value);
                  if (e.target.value.endsWith('@') && !showImagePicker) openImagePicker();
                }}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder={t('chat.placeholder')} disabled={isTyping}
                className="flex-1 h-10 sm:h-12 pl-4 rounded-xl bg-muted/30 border-none focus-visible:ring-2 focus-visible:ring-primary/20 text-sm" />
              <button
                onClick={() => { if (!voiceSupported) { toast.error(t('voice.notSupported')); return; } isListening ? stopListening() : startListening(); }}
                disabled={isTyping}
                className={cn("shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                  isListening ? "bg-red-500 text-white shadow-lg shadow-red-500/30 animate-pulse" : "bg-muted/50 text-muted-foreground hover:bg-primary/10 hover:text-primary")}>
                <Mic className="w-4 h-4" />
              </button>
              <button onClick={() => handleSend()} disabled={!input.trim() || isTyping}
                className="shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed">
                {isTyping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </Card>

        {/* ── Sidebar ── */}
        <div className="lg:col-span-4 flex flex-col gap-5 h-full min-h-0 order-2">

          {/* Past Conversations */}
          <Card className="rounded-3xl border-border/50 bg-card/50 backdrop-blur-sm flex flex-col flex-1 min-h-0 overflow-hidden">
            <CardHeader className="p-4 sm:p-5 pb-3 border-b border-border/30">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5" /> Past Conversations
                </CardTitle>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-primary px-2" onClick={createNewChat}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> New
                </Button>
              </div>
            </CardHeader>
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {isLoadingChats ? (
                <ConversationSkeleton />
              ) : chats.length > 0 ? chats.map(chat => (
                <button key={chat.id} onClick={() => loadChat(chat.id)}
                  className={cn("w-full text-left p-3 rounded-xl border transition-all duration-200 group",
                    currentChatId === chat.id
                      ? "bg-primary/15 border-primary/30 text-primary shadow-sm"
                      : "border-transparent bg-muted/20 hover:bg-muted/50 text-muted-foreground hover:text-foreground")}>
                  <div className="flex items-start gap-2.5">
                    <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                      currentChatId === chat.id ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary")}>
                      <MessageSquare className="w-3 h-3" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate leading-tight">{chat.title || 'Untitled Chat'}</p>
                      {chat.updatedAt && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {parseSafeDate(chat.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </p>
                      )}
                    </div>
                    <ChevronRight className={cn("w-3.5 h-3.5 shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-all -translate-x-1 group-hover:translate-x-0",
                      currentChatId === chat.id && "opacity-100 translate-x-0 text-primary")} />
                  </div>
                </button>
              )) : (
                <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-muted-foreground/50" />
                  </div>
                  <p className="text-xs text-muted-foreground">No past chats yet.<br />Start a conversation!</p>
                </div>
              )}
            </div>
          </Card>

          {/* Quick Actions */}
          <Card className="rounded-3xl border-border/50 bg-card/50 backdrop-blur-sm p-4 sm:p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2 mb-3">
              <Zap className="w-3.5 h-3.5 text-amber-500" /> Quick Actions
            </p>
            <div className="space-y-2">
              {QUICK_ACTIONS.map((action, i) => (
                <button key={i} onClick={() => handleSend(action.query)} disabled={isTyping}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-border/40 bg-background/30 hover:bg-primary hover:text-white hover:border-primary text-muted-foreground hover:shadow-md hover:shadow-primary/10 transition-all duration-200 group disabled:opacity-40 disabled:cursor-not-allowed">
                  <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors", action.color, "group-hover:bg-white/20")}>
                    <action.icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-semibold text-left truncate">{action.label}</span>
                  <ChevronRight className="w-3 h-3 ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          </Card>

        </div>
      </div>
    </div>
  );
}
