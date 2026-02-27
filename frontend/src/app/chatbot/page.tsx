"use client"

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send, Mic, Bot, User, RotateCcw, Download, Info,
  Waves, Fish, CloudRain, BookOpen, HelpCircle, Plus, Loader2,
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { sendChat, getChatHistory } from "@/lib/api-client";
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

export default function ChatbotPage() {
  const { user } = useAuth();
  const { t, speechCode } = useLanguage();
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
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

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

  // ── Load chat history on mount ─────────────────────────────────────────────
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const history = await getChatHistory(20);
        if (history.length > 0) {
          const historicalMessages: Message[] = history.flatMap((chat) => [
            {
              id: `${chat.chatId}_user`,
              role: 'user' as const,
              content: chat.message,
              timestamp: new Date(chat.timestamp),
            },
            {
              id: `${chat.chatId}_ai`,
              role: 'assistant' as const,
              content: chat.response,
              timestamp: new Date(chat.timestamp),
            },
          ]);
          setMessages((prev) => [...historicalMessages, ...prev]);
        }
      } catch {
        // Silently ignore history load errors
      } finally {
        setIsLoadingHistory(false);
      }
    };
    loadHistory();
  }, []);

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
      const { response, timestamp } = await sendChat(text);
      const assistantMessage: Message = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        content: response,
        timestamp: new Date(timestamp),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      toast.error(t('chat.error'));
      console.error("Chat error:", err);
    } finally {
      setIsTyping(false);
    }
  }, [input, isTyping, t]);

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

  const clearChat = () => {
    setMessages([{
      id: 'welcome_fresh',
      role: 'assistant',
      content: t('chat.cleared'),
      timestamp: new Date(),
    }]);
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
    <div className="h-full sm:h-[calc(100vh-140px)] flex flex-col space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t('chat.title')}</h1>
          <p className="text-sm sm:text-base text-muted-foreground">{t('chat.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1 sm:flex-none rounded-xl bg-card border-border h-10 sm:h-12 text-xs sm:text-sm"
            onClick={clearChat}
          >
            <RotateCcw className="mr-2 w-4 h-4" />
            {t('chat.reset')}
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
          <ScrollArea className="flex-1 p-4 sm:p-6 lg:p-10" ref={scrollAreaRef}>
            <div className="space-y-6 sm:space-y-8 pb-4">
              {isLoadingHistory && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {t('chat.loadingHistory')}
                </div>
              )}

              {messages.map((msg) => (
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
                      "text-[8px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-2",
                      msg.role === 'user' && "text-right"
                    )}>
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
          </ScrollArea>

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
            <div className="relative z-10 space-y-4 sm:space-y-6">
              <div className="space-y-1">
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{t('chat.quickActions')}</h3>
                <p className="text-[10px] sm:text-xs text-muted-foreground">{t('chat.quickActionsDesc')}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2 sm:gap-3">
                {QUICK_ACTIONS.map((action, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    className="h-12 sm:h-14 justify-start gap-3 sm:gap-4 px-4 sm:px-5 rounded-xl sm:rounded-2xl border-border/50 bg-background/30 hover:bg-primary hover:text-white transition-all duration-300 group"
                    onClick={() => handleSend(action.query)}
                    disabled={isTyping}
                  >
                    <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-primary/5 text-primary group-hover:bg-white/20 group-hover:text-white transition-colors">
                      <action.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                    <span className="font-bold text-xs sm:text-sm tracking-tight">{action.label}</span>
                  </Button>
                ))}
              </div>
            </div>
          </Card>

          <Card className="rounded-3xl border-none bg-blue-500/5 p-6 flex-1 overflow-hidden">
            <div className="space-y-6 h-full flex flex-col">
              <div className="space-y-1">
                <h3 className="text-sm font-bold uppercase tracking-widest text-blue-500">{t('chat.suggestedTopics')}</h3>
                <p className="text-xs text-blue-400/80">{t('chat.suggestedTopicsDesc')}</p>
              </div>

              <ScrollArea className="flex-1">
                <div className="space-y-4">
                  {SUGGESTED_TOPICS.map((topic, i) => (
                    <div
                      key={i}
                      className="p-4 rounded-xl border border-blue-500/10 bg-white/5 hover:bg-blue-500/10 transition-colors cursor-pointer text-[13px] font-medium leading-relaxed group"
                      onClick={() => handleSend(topic)}
                    >
                      <div className="flex gap-3">
                        <Plus className="w-4 h-4 text-blue-500 shrink-0 mt-0.5 group-hover:scale-125 transition-transform" />
                        {topic}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="pt-4 border-t border-blue-500/10">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
                  <Info className="w-4 h-4 shrink-0" />
                  <p className="text-[11px] font-semibold italic">
                    {t('chat.dataSource')}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
