import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    ActivityIndicator,
    Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { sendChat, getChatHistory } from '../../lib/api-client';
import type { ChatMessage } from '../../lib/mock-api';
import { COLORS, FONTS, SPACING, RADIUS } from '../../lib/constants';
import { useAuth } from '../../lib/auth-context';
import { useLanguage } from '../../lib/i18n';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import * as Speech from 'expo-speech';

interface UIMessage {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    timestamp: Date;
}

export default function ChatScreen() {
    const { user } = useAuth();
    const { t, locale, isLoaded } = useLanguage();
    const params = useLocalSearchParams();

    const QUICK_ACTIONS = [
        t('chat.actionFishToday'),
        t('chat.actionMarketPrices'),
        t('chat.actionOceanConditions'),
        t('chat.actionSustainability'),
        t('chat.actionRegulations'),
        t('chat.actionTips'),
    ];

    const [messages, setMessages] = useState<UIMessage[]>([
        {
            id: 'welcome',
            role: 'assistant',
            text: t('chat.welcome'),
            timestamp: new Date(),
        },
    ]);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [currentChatId, setCurrentChatId] = useState<string | null>(null);
    const [chats, setChats] = useState<{ id: string, title: string }[]>([]);
    const [showSidebar, setShowSidebar] = useState(false);

    const flatListRef = useRef<FlatList>(null);
    const initialMessageSent = useRef(false);

    useEffect(() => {
        if (params.initialMessage && !initialMessageSent.current) {
            initialMessageSent.current = true;
            // Create a new chat context and send the initial message
            setCurrentChatId(null);
            setMessages([]);
            setTimeout(() => {
                sendMessage(params.initialMessage as string);
            }, 500);
        }
    }, [params]);

    useEffect(() => {
        // Load past chats on mount
        import('../../lib/api-client').then(m => {
            m.getConversationsList().then(res => {
                setChats(res.map(c => ({ id: c.conversationId, title: c.title })));
                if (res.length > 0 && !params.initialMessage) {
                    loadChat(res[0].conversationId);
                }
            }).catch(console.warn);
        });
    }, []);

    const speakMessage = (text: string) => {
        if (isSpeaking) {
            Speech.stop();
            setIsSpeaking(false);
        } else {
            setIsSpeaking(true);
            Speech.speak(text, { onDone: () => setIsSpeaking(false), onError: () => setIsSpeaking(false) });
        }
    };

    const loadChat = async (chatId: string) => {
        setCurrentChatId(chatId);
        setShowSidebar(false);
        setMessages([]);
        setIsTyping(true);
        Speech.stop();
        setIsSpeaking(false);
        try {
            const { getChatHistory } = await import('../../lib/api-client');
            const history = await getChatHistory(50, chatId);
            const formatted = history.map(msg => ({
                id: msg.id,
                role: msg.role as 'user' | 'assistant',
                text: msg.text,
                timestamp: new Date(msg.timestamp)
            }));
            setMessages(formatted.length > 0 ? formatted : [{
                id: 'welcome',
                role: 'assistant',
                text: t('chat.welcome'),
                timestamp: new Date(),
            }]);
        } catch (e) {
            console.warn(e);
        } finally {
            setIsTyping(false);
        }
    };

    const createNewChat = () => {
        setCurrentChatId(null);
        setMessages([{
            id: 'welcome',
            role: 'assistant',
            text: t('chat.welcome'),
            timestamp: new Date(),
        }]);
        setShowSidebar(false);
        Speech.stop();
        setIsSpeaking(false);
    };

    const sendMessage = async (text: string) => {
        const trimmed = text.trim();
        if (!trimmed || isTyping) return;

        Speech.stop();
        setIsSpeaking(false);

        setInputText('');
        Keyboard.dismiss();

        const userMsg: UIMessage = {
            id: `user_${Date.now()}`,
            role: 'user',
            text: trimmed,
            timestamp: new Date(),
        };
        setMessages((prev) => [...prev, userMsg]);
        setIsTyping(true);

        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

        try {
            let targetChatId = currentChatId;

            if (!targetChatId) {
                try {
                    const { createConversation } = await import('../../lib/api-client');
                    const newConv = await createConversation(trimmed.substring(0, 40), locale);
                    targetChatId = newConv.conversationId;
                    setCurrentChatId(targetChatId);
                    if (targetChatId) {
                        setChats(prev => [{ id: targetChatId as string, title: trimmed.substring(0, 40) }, ...prev]);
                    }
                } catch (e) {
                    console.warn("Failed to explicitly create conversation", e);
                }
            }

            const { sendChat } = await import('../../lib/api-client');
            const res = await sendChat(trimmed, targetChatId ?? undefined, locale);

            if (!targetChatId && res.chatId && !res.chatId.startsWith('demo_')) {
                setCurrentChatId(res.chatId);
                setChats(prev => [{ id: res.chatId, title: trimmed }, ...prev]);
            }
            const botMsg: UIMessage = {
                id: `bot_${Date.now()}`,
                role: 'assistant',
                text: res.response,
                timestamp: new Date(res.timestamp),
            };
            setMessages((prev) => [...prev, botMsg]);

            // Optional auto speech: speakMessage(res.response); // Removing auto-TTS for noise control, user can click to play
        } catch {
            setMessages((prev) => [
                ...prev,
                {
                    id: `err_${Date.now()}`,
                    role: 'assistant',
                    text: t('common.error'),
                    timestamp: new Date(),
                },
            ]);
        } finally {
            setIsTyping(false);
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 150);
        }
    };

    const renderMessage = ({ item }: { item: UIMessage }) => {
        const isUser = item.role === 'user';
        return (
            <View style={[styles.messageRow, isUser && styles.messageRowUser]}>
                {!isUser && (
                    <View style={styles.avatar}>
                        <Text style={styles.avatarEmoji}>🤖</Text>
                    </View>
                )}
                <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}>
                    <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{item.text}</Text>
                    <View style={styles.bubbleFooter}>
                        {!isUser && (
                            <TouchableOpacity onPress={() => speakMessage(item.text)} style={styles.ttsBtn}>
                                <Ionicons name={isSpeaking ? "volume-mute" : "volume-high"} size={14} color={COLORS.primaryLight} />
                            </TouchableOpacity>
                        )}
                        <Text style={[styles.bubbleTime, isUser && styles.bubbleTimeUser]}>
                            {item.timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    </View>
                </View>
                {isUser && (
                    <View style={[styles.avatar, styles.avatarUser]}>
                        <Text style={styles.avatarText}>{(user?.name ?? 'U')[0].toUpperCase()}</Text>
                    </View>
                )}
            </View>
        );
    };

    if (!isLoaded) return null;

    return (
        <SafeAreaView style={styles.safe}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Text style={styles.headerEmoji}>🤖</Text>
                    <View>
                        <Text style={styles.headerTitle}>{currentChatId ? chats.find(c => c.id === currentChatId)?.title || t('chat.title') : 'New Chat'}</Text>
                        <View style={styles.onlineRow}>
                            <View style={styles.onlineDot} />
                            <Text style={styles.onlineText}>{t('chat.status')}</Text>
                        </View>
                    </View>
                </View>
                <TouchableOpacity onPress={() => setShowSidebar(!showSidebar)}>
                    <Ionicons name="menu" size={28} color={COLORS.textPrimary} />
                </TouchableOpacity>
            </View>

            {/* Chats Drawer Modal inline */}
            {showSidebar && (
                <View style={styles.sidebar}>
                    <TouchableOpacity style={styles.newChatBtn} onPress={createNewChat}>
                        <Ionicons name="add" size={20} color="#fff" />
                        <Text style={styles.newChatText}>New Chat</Text>
                    </TouchableOpacity>
                    <ScrollView style={styles.chatListScroll}>
                        {chats.map(chat => (
                            <TouchableOpacity
                                key={chat.id}
                                style={[styles.chatListItem, currentChatId === chat.id && styles.chatListItemActive]}
                                onPress={() => loadChat(chat.id)}
                            >
                                <Ionicons name="chatbubble-outline" size={16} color={currentChatId === chat.id ? COLORS.primary : COLORS.textMuted} />
                                <Text style={[styles.chatListText, currentChatId === chat.id && styles.chatListTextActive]} numberOfLines={1}>{chat.title}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.flex}
                keyboardVerticalOffset={0}
            >
                {/* Message List */}
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.messageList}
                    showsVerticalScrollIndicator={false}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                />

                {/* Typing Indicator */}
                {isTyping && (
                    <View style={styles.typingRow}>
                        <View style={styles.avatar}>
                            <Text style={styles.avatarEmoji}>🤖</Text>
                        </View>
                        <View style={styles.typingBubble}>
                            <ActivityIndicator size="small" color={COLORS.textMuted} />
                            <Text style={styles.typingText}>{t('chat.typing')}</Text>
                        </View>
                    </View>
                )}

                {/* Quick Actions */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.quickActionsScroll}
                    style={styles.quickActionsContainer}
                    keyboardShouldPersistTaps="always"
                >
                    {QUICK_ACTIONS.map((action) => (
                        <TouchableOpacity
                            key={action}
                            style={styles.quickActionChip}
                            onPress={() => sendMessage(action)}
                            activeOpacity={0.75}
                            disabled={isTyping}
                        >
                            <Text style={styles.quickActionText}>{action}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Input Bar */}
                <View style={styles.inputBar}>
                    <TouchableOpacity
                        style={styles.micBtnOuter}
                        activeOpacity={0.8}
                        onPress={() => alert(t('chat.micHint') || "Use your keyboard's microphone for voice typing.")}
                    >
                        <Ionicons name="mic" size={24} color={COLORS.primaryLight} />
                    </TouchableOpacity>

                    <View style={styles.inputWrapper}>
                        <TextInput
                            style={styles.textInput}
                            value={inputText}
                            onChangeText={setInputText}
                            placeholder={t('chat.placeholder')}
                            placeholderTextColor={COLORS.textSubtle}
                            multiline
                            maxLength={500}
                            returnKeyType="send"
                            onSubmitEditing={() => sendMessage(inputText)}
                        />
                        <TouchableOpacity
                            style={[styles.sendBtn, (!inputText.trim() || isTyping) && styles.sendBtnDisabled]}
                            onPress={() => sendMessage(inputText)}
                            disabled={!inputText.trim() || isTyping}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="send" size={18} color="#fff" style={{ marginLeft: 2 }} />
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: COLORS.bgDark },
    flex: { flex: 1 },

    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: SPACING.xl,
        paddingBottom: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
    headerEmoji: { fontSize: 32 },
    headerTitle: { fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.bold, color: COLORS.textPrimary },
    onlineRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginTop: 2 },
    onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.success },
    onlineText: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },

    messageList: { padding: SPACING.base, paddingBottom: SPACING.sm, gap: SPACING.md },

    messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: SPACING.sm },
    messageRowUser: { flexDirection: 'row-reverse' },

    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.bgCard,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    avatarUser: { backgroundColor: COLORS.primary },
    avatarEmoji: { fontSize: 16 },
    avatarText: { fontSize: FONTS.sizes.sm, color: '#fff', fontWeight: FONTS.weights.bold },

    bubble: {
        maxWidth: '75%',
        borderRadius: RADIUS.xl,
        padding: SPACING.md,
        gap: SPACING.xs,
    },
    bubbleBot: {
        backgroundColor: COLORS.bgCard,
        borderTopLeftRadius: RADIUS.sm,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    bubbleUser: {
        backgroundColor: COLORS.primary,
        borderTopRightRadius: RADIUS.sm,
    },
    bubbleText: { fontSize: FONTS.sizes.sm, color: COLORS.textSecondary, lineHeight: 22 },
    bubbleTextUser: { color: '#fff' },
    bubbleFooter: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 4, gap: SPACING.md },
    bubbleTime: { fontSize: FONTS.sizes.xs, color: COLORS.textSubtle },
    bubbleTimeUser: { color: 'rgba(255,255,255,0.6)' },
    ttsBtn: { padding: 2 },

    typingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        paddingHorizontal: SPACING.base,
        paddingVertical: SPACING.xs,
    },
    typingBubble: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        backgroundColor: COLORS.bgCard,
        borderRadius: RADIUS.xl,
        padding: SPACING.md,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    typingText: { color: COLORS.textMuted, fontSize: FONTS.sizes.sm, fontStyle: 'italic' },

    quickActionsContainer: {
        maxHeight: 50,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    quickActionsScroll: {
        paddingHorizontal: SPACING.base,
        paddingVertical: SPACING.sm,
        gap: SPACING.sm,
        alignItems: 'center',
    },
    quickActionChip: {
        backgroundColor: COLORS.bgCard,
        borderRadius: RADIUS.full,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.xs,
        flexShrink: 0,
    },
    quickActionText: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.medium },

    inputBar: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        padding: SPACING.md,
        paddingBottom: Math.max(SPACING.base, 20), // Extra padding for safe area since keyboard might cut it close
        gap: SPACING.sm,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        backgroundColor: COLORS.bgDark,
    },
    micBtnOuter: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.primary + '15',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: COLORS.primary + '30',
        marginBottom: 2, // Align with input
    },
    inputWrapper: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'flex-end',
        backgroundColor: COLORS.bgCard,
        borderRadius: RADIUS.xl,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingLeft: SPACING.base,
        paddingRight: SPACING.xs,
        paddingVertical: 4,
    },
    textInput: {
        flex: 1,
        paddingVertical: SPACING.sm,
        color: COLORS.textPrimary,
        fontSize: FONTS.sizes.sm,
        maxHeight: 100,
        minHeight: 36, // Ensure consistent height with the send button
    },
    sendBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 2, // Ensure it stays aligned with the bottom of the input
    },
    sendBtnDisabled: { backgroundColor: COLORS.border },

    sidebar: { backgroundColor: COLORS.bgDark, borderBottomWidth: 1, borderBottomColor: COLORS.border, padding: SPACING.md, maxHeight: 250 },
    newChatBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, padding: SPACING.sm, borderRadius: RADIUS.md, gap: SPACING.sm, justifyContent: 'center', marginBottom: SPACING.sm },
    newChatText: { color: '#fff', fontSize: FONTS.sizes.sm, fontWeight: FONTS.weights.bold },
    chatListScroll: { flexGrow: 1 },
    chatListItem: { flexDirection: 'row', alignItems: 'center', padding: SPACING.sm, gap: SPACING.sm, borderRadius: RADIUS.sm },
    chatListItemActive: { backgroundColor: COLORS.bgCard },
    chatListText: { color: COLORS.textSecondary, fontSize: FONTS.sizes.sm, flex: 1 },
    chatListTextActive: { color: COLORS.primaryLight, fontWeight: FONTS.weights.bold },
});
