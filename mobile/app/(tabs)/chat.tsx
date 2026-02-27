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

const QUICK_ACTIONS = [
    '🐟 What should I fish today?',
    '💰 Best market prices now',
    '🌊 Ocean conditions update',
    '♻️ Sustainability advice',
    '📏 Fishing regulations',
    '🎯 Technique tips',
];

interface UIMessage {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    timestamp: Date;
}

export default function ChatScreen() {
    const { user } = useAuth();
    const [messages, setMessages] = useState<UIMessage[]>([
        {
            id: 'welcome',
            role: 'assistant',
            text: `Namaste! 🙏 I'm your AI fishing assistant. I can help you with:\n\n• Fish identification guidance\n• Best fishing locations & times\n• Market prices & buyer info\n• Weather & ocean conditions\n• Sustainability & regulations\n\nWhat would you like to know today?`,
            timestamp: new Date(),
        },
    ]);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    const sendMessage = async (text: string) => {
        const trimmed = text.trim();
        if (!trimmed || isTyping) return;
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
            const res = await sendChat(trimmed);
            const botMsg: UIMessage = {
                id: `bot_${Date.now()}`,
                role: 'assistant',
                text: res.response,
                timestamp: new Date(res.timestamp),
            };
            setMessages((prev) => [...prev, botMsg]);
        } catch {
            setMessages((prev) => [
                ...prev,
                {
                    id: `err_${Date.now()}`,
                    role: 'assistant',
                    text: 'Sorry, I could not process your request. Please try again.',
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
                    <Text style={[styles.bubbleTime, isUser && styles.bubbleTimeUser]}>
                        {item.timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </View>
                {isUser && (
                    <View style={[styles.avatar, styles.avatarUser]}>
                        <Text style={styles.avatarText}>{(user?.name ?? 'U')[0].toUpperCase()}</Text>
                    </View>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.safe}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Text style={styles.headerEmoji}>🤖</Text>
                    <View>
                        <Text style={styles.headerTitle}>AI Fishing Assistant</Text>
                        <View style={styles.onlineRow}>
                            <View style={styles.onlineDot} />
                            <Text style={styles.onlineText}>Online · Demo Mode</Text>
                        </View>
                    </View>
                </View>
            </View>

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
                            <Text style={styles.typingText}>Thinking...</Text>
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
                    <TextInput
                        style={styles.textInput}
                        value={inputText}
                        onChangeText={setInputText}
                        placeholder="Ask about fish, prices, weather..."
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
                        <Text style={styles.sendBtnText}>➤</Text>
                    </TouchableOpacity>
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
    bubbleTime: { fontSize: FONTS.sizes.xs, color: COLORS.textSubtle, alignSelf: 'flex-end' },
    bubbleTimeUser: { color: 'rgba(255,255,255,0.6)' },

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
        paddingBottom: SPACING.base,
        gap: SPACING.sm,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        backgroundColor: COLORS.bgDark,
    },
    textInput: {
        flex: 1,
        backgroundColor: COLORS.bgCard,
        borderRadius: RADIUS.xl,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingHorizontal: SPACING.base,
        paddingVertical: SPACING.md,
        color: COLORS.textPrimary,
        fontSize: FONTS.sizes.sm,
        maxHeight: 100,
    },
    sendBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 4,
    },
    sendBtnDisabled: { backgroundColor: COLORS.border },
    sendBtnText: { color: '#fff', fontSize: FONTS.sizes.md, fontWeight: FONTS.weights.bold },
});
