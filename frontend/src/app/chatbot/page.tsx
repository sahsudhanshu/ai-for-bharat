"use client"

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send, Mic, Bot, User, RotateCcw, Download, Info,
  Waves, Fish, CloudRain, BookOpen, HelpCircle, Plus, Loader2, Volume2,
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { sendChat, getChatHistory, getConversationsList, createConversation } from "@/lib/api-client";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/i18n";
import { useVoiceInput } from "@/hooks/useVoiceInput";

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const parseSafeDate = (dateInput: string | Date | undefined): Date => {
  if (!dateInput) return new Date();
  let d = new Date(dateInput);
  if (isNaN(d.getTime()) && typeof dateInput === 'string') {
    // Backend may have generated a hex string in the ms part, clean it up
    d = new Date(dateInput.replace(/\.[0-9a-fA-F]{3}Z$/, '.000Z'));
  }
  return isNaN(d.getTime()) ? new Date() : d;
};

export default function ChatbotPage() {
  const { user } = useAuth();
  const { t, locale, speechCode } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: t('chat.welcome'),
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [chats, setChats] = useState<{ id: string, title: string }[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasInitialized = useRef(false);

  // ── Text To Speech ──────────────────────────────────────────────────────────
  const handlePlayAudio = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = speechCode || 'en-US';
      window.speechSynthesis.speak(utterance);
    } else {
      toast.error('Text-to-speech is not supported in your browser.');
    }
  };

  // ── Voice Input ─────────────────────────────────────────────────────────────
  const { isListening, transcript, isSupported: voiceSupported, startListening, stopListening } = useVoiceInput({
    lang: speechCode,
    onResult: (text) => {
      setInput(text);
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  // Update input with interim transcript while listening
  useEffect(() => {
    if (isListening && transcript) {
      setInput(transcript);
    }
  }, [transcript, isListening]);

  // ── Quick actions with translated labels ───────────────────────────────────
  const QUICK_ACTIONS = [
    { label: t('chat.action.fish'), icon: Fish, query: "How do I identify fish species?" },
    { label: t('chat.action.weather'), icon: CloudRain, query: "What are the sea conditions today?" },
    { label: t('chat.action.ocean'), icon: Waves, query: "What are the current ocean conditions?" },
    { label: t('chat.action.regulations'), icon: BookOpen, query: "What are the fishing regulations?" },
    { label: t('chat.action.tips'), icon: HelpCircle, query: "Give me tips to improve my catch quality" },
  ];

  const SUGGESTED_TOPICS = [
    "What's the best time to fish for Kingfish near Ratnagiri?",
    "How to distinguish between Silver and White Pomfret?",
    "Current safety warnings for high-sea vessels near Malabar?",
    "Latest GST regulations for small-scale fishermen exports.",
    "Sustainable net mesh size recommendations for the Konkan coast.",
  ];



  const loadChat = async (chatId: string) => {
    setCurrentChatId(chatId);
    setMessages([]);
    setIsLoadingHistory(true);
    try {
      const history = await getChatHistory(50, chatId);
      const formatted: Message[] = history.map(msg => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        content: msg.text,
        timestamp: parseSafeDate(msg.timestamp)
      }));
      setMessages(formatted.length > 0 ? formatted : [{
        id: 'welcome',
        role: 'assistant',
        content: t('chat.welcome'),
        timestamp: new Date(),
      }]);
    } catch {
      toast.error("Failed to load conversation");
    } finally {
      setIsLoadingHistory(false);
    }
  };



  const createNewChat = () => {
    setCurrentChatId(null);
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: t('chat.welcome'),
      timestamp: new Date(),
    }]);
  };

  // ── Auto-scroll to bottom ──────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // ── Send message ───────────────────────────────────────────────────────────
  const handleSend = useCallback(async (messageText?: string) => {
    const text = (messageText ?? input).trim();
    if (!text || isTyping) return;

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    try {
      let targetChatId = currentChatId;

      // If we are starting a new chat, explicitly create the conversation on the backend
      if (!targetChatId) {
        try {
          const newConv = await createConversation(text.substring(0, 40), locale);
          targetChatId = newConv.conversationId;
          setCurrentChatId(targetChatId);
          setChats(prev => [{ id: newConv.conversationId, title: text.substring(0, 40) }, ...prev]);
        } catch (e) {
          console.error("Failed to explicitly create conversation", e);
        }
      }

      const res = await sendChat(text, targetChatId ?? undefined, locale);

      // Fallback in case the createConversation step failed or was skipped
      if (!targetChatId && res.chatId && !res.chatId.startsWith('demo_')) {
        setCurrentChatId(res.chatId);
        setChats(prev => [{ id: res.chatId, title: text }, ...prev]);
      }

      const assistantMessage: Message = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        content: res.response,
        timestamp: parseSafeDate(res.timestamp),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      toast.error(t('chat.error'));
      console.error("Chat error:", err);
    } finally {
      setIsTyping(false);
    }
  }, [input, isTyping, t, currentChatId]);

  // ── Load conversations and History on mount ──────────────────────────────────
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const init = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const analysisId = urlParams.get('analysisId');

        const convList = await getConversationsList();
        setChats(convList.map(c => ({ id: c.conversationId, title: c.title })));

        if (analysisId) {
          window.history.replaceState({}, document.title, window.location.pathname);
          setIsLoadingHistory(false);
          // Wait briefly, then pre-fill and send
          setTimeout(() => {
            handleSend(`Look up the details of my catch with Image ID: ${analysisId} and provide advice on its market value and sustainability.`);
          }, 800);
        } else if (convList.length > 0) {
          await loadChat(convList[0].conversationId);
        } else {
          setIsLoadingHistory(false);
        }
      } catch {
        setIsLoadingHistory(false);
      }
    };
    init();
  }, [handleSend]);

  // ── Export chat ────────────────────────────────────────────────────────────
  const exportChat = () => {
    const content = messages
      .map((m) => `[${m.timestamp.toLocaleString()}] ${m.role === 'user' ? 'You' : 'OceanAI'}: ${m.content}`)
      .join('\n\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `oceanai-chat-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('chat.exported'));
  };

  const handleClearChat = () => {
    createNewChat();
  };

  const handleMicClick = () => {
    if (!voiceSupported) {
      toast.error(t('voice.notSupported'));
      return;
    }
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <div className="flex flex-col space-y-4 sm:space-y-6 h-[calc(100dvh-185px)] sm:h-[calc(100dvh-210px)] lg:h-[calc(100dvh-185px)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t('chat.title')}</h1>
          <p className="text-sm sm:text-base text-muted-foreground">{t('chat.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1 sm:flex-none rounded-xl bg-card border-border h-10 sm:h-12 text-xs sm:text-sm transition-colors hover:bg-primary/5 hover:text-primary"
            onClick={createNewChat}
          >
            <Plus className="mr-2 w-4 h-4" />
            New Chat
          </Button>
          <Button
            variant="outline"
            className="flex-1 sm:flex-none rounded-xl bg-card border-border h-10 sm:h-12 text-xs sm:text-sm"
            onClick={exportChat}
          >
            <Download className="mr-2 w-4 h-4" />
            {t('chat.exportChat')}
          </Button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 min-h-0">
        {/* Chat Area */}
        <Card className="lg:col-span-8 rounded-3xl border-border/50 bg-card/50 backdrop-blur-sm flex flex-col h-[500px] sm:h-full overflow-hidden order-1">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-10" ref={scrollAreaRef}>
            <div className="space-y-6 sm:space-y-8 pb-4">
              {isLoadingHistory ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2 animate-pulse">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {t('chat.loadingHistory')}
                </div>
              ) : messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-3 sm:gap-4 max-w-[90%] sm:max-w-[85%] animate-in fade-in slide-in-from-bottom-2 duration-300",
                    msg.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                  )}
                >
                  <Avatar className={cn(
                    "h-8 w-8 sm:h-10 sm:w-10 shrink-0 border-2",
                    msg.role === 'assistant' ? "border-primary/20" : "border-border/50"
                  )}>
                    {msg.role === 'assistant' ? (
                      <div className="bg-primary h-full w-full flex items-center justify-center text-white">
                        <Bot className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>
                    ) : (
                      <>
                        <AvatarImage src={user?.avatar} />
                        <AvatarFallback className="bg-muted text-xs font-bold">
                          {user?.name?.charAt(0) ?? 'ME'}
                        </AvatarFallback>
                      </>
                    )}
                  </Avatar>
                  <div className="space-y-1 sm:space-y-2">
                    <div className={cn(
                      "p-3 sm:p-5 rounded-2xl sm:rounded-3xl leading-relaxed text-sm sm:text-[15px] shadow-sm",
                      msg.role === 'assistant'
                        ? "bg-card border border-border/50 text-foreground rounded-tl-none"
                        : "bg-primary text-white rounded-tr-none"
                    )}>
                      {msg.content}
                    </div>
                    <div className={cn(
                      "flex items-center gap-2 text-[8px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-2",
                      msg.role === 'user' ? "justify-end" : "justify-start"
                    )}>
                      {msg.role === 'assistant' && (
                        <button
                          onClick={() => handlePlayAudio(msg.content)}
                          className="hover:text-primary transition-colors flex items-center gap-1.5"
                          title="Play Audio"
                        >
                          <Volume2 className="w-3 h-3" />
                        </button>
                      )}
                      <span>{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex gap-3 sm:gap-4 max-w-[85%] mr-auto">
                  <Avatar className="h-8 w-8 sm:h-10 sm:w-10 shrink-0 border-2 border-primary/20">
                    <div className="bg-primary h-full w-full flex items-center justify-center text-white">
                      <Bot className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                  </Avatar>
                  <div className="bg-card border border-border/50 p-3 sm:p-5 rounded-2xl sm:rounded-3xl rounded-tl-none flex gap-1.5 items-center">
                    <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                    <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* Voice listening indicator */}
          {isListening && (
            <div className="px-4 sm:px-6 py-2 border-t border-primary/20 bg-primary/5 flex items-center gap-3 animate-in fade-in duration-200">
              <div className="relative flex items-center justify-center">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <div className="absolute w-6 h-6 bg-red-500/20 rounded-full animate-ping" />
              </div>
              <span className="text-sm font-medium text-primary">{t('voice.listening')}</span>
              <span className="text-xs text-muted-foreground">{t('voice.tapToStop')}</span>
            </div>
          )}

          {/* Input bar */}
          <div className="p-4 sm:p-6 border-t border-border/50 bg-background/30">
            <div className="relative group">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder={t('chat.placeholder')}
                disabled={isTyping}
                className="h-12 sm:h-16 pl-4 sm:pl-6 pr-24 sm:pr-32 rounded-xl sm:rounded-2xl bg-muted/30 border-none focus-visible:ring-2 focus-visible:ring-primary/20 text-sm sm:text-base"
              />
              <div className="absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 sm:gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-9 w-9 sm:h-12 sm:w-12 rounded-lg sm:rounded-xl transition-all",
                    isListening
                      ? "bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/30"
                      : "text-muted-foreground hover:text-primary"
                  )}
                  onClick={handleMicClick}
                  disabled={isTyping}
                >
                  <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
                </Button>
                <Button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isTyping}
                  className="h-9 w-9 sm:h-12 sm:w-12 rounded-lg sm:rounded-xl bg-primary text-white shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isTyping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 sm:w-5 sm:h-5" />}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-6 flex flex-col h-full order-2">
          <Card className="rounded-3xl border-border/50 bg-card/50 backdrop-blur-sm p-4 sm:p-6 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-6 opacity-5">
              <Bot className="w-16 sm:w-24 h-16 sm:h-24" />
            </div>
            <div className="relative z-10 space-y-4 sm:space-y-6 h-full flex flex-col">
              <div className="space-y-1">
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Past Conversations</h3>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Select a previous chat to resume</p>
              </div>

              <div className="flex-1 h-0 min-h-0 overflow-y-auto">
                <div className="space-y-2 pr-4">
                  {chats.length > 0 ? chats.map((chat) => (
                    <div
                      key={chat.id}
                      className={cn(
                        "p-3 rounded-xl border transition-colors cursor-pointer text-xs sm:text-[13px] font-medium leading-relaxed group",
                        currentChatId === chat.id
                          ? "bg-primary/20 border-primary/30 text-primary"
                          : "border-border/50 bg-background/30 hover:bg-primary/5 text-muted-foreground hover:text-primary"
                      )}
                      onClick={() => loadChat(chat.id)}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <HelpCircle className={cn(
                          "w-3.5 h-3.5 shrink-0 transition-transform group-hover:scale-110",
                          currentChatId === chat.id ? "text-primary" : "text-muted-foreground"
                        )} />
                        <span className="truncate whitespace-nowrap overflow-hidden block flex-1">
                          {chat.title}
                        </span>
                      </div>
                    </div>
                  )) : (
                    <p className="text-xs text-muted-foreground italic px-2">No past chats yet.</p>
                  )}
                </div>
              </div>

              <div className="space-y-4 border-t border-border/50 pt-4 mt-auto">
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('chat.quickActions')}</h3>
                <div className="grid grid-cols-1 gap-2">
                  {QUICK_ACTIONS.slice(0, 3).map((action, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      className="h-10 justify-start gap-3 px-4 rounded-xl border-border/50 bg-background/30 hover:bg-primary hover:text-white transition-all duration-300 group"
                      onClick={() => handleSend(action.query)}
                      disabled={isTyping}
                    >
                      <action.icon className="w-3.5 h-3.5" />
                      <span className="font-bold text-xs tracking-tight truncate">{action.label}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </Card>

        </div>
      </div>
    </div>
  );
}
