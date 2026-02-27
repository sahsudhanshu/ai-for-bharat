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

interface UIMessage {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    timestamp: Date;
}

export default function ChatScreen() {
    const { user } = useAuth();
    const { t, isLoaded } = useLanguage();

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

    if (!isLoaded) return null;

    return (
        <SafeAreaView style={styles.safe}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Text style={styles.headerEmoji}>🤖</Text>
                    <View>
                        <Text style={styles.headerTitle}>{t('chat.title')}</Text>
                        <View style={styles.onlineRow}>
                            <View style={styles.onlineDot} />
                            <Text style={styles.onlineText}>{t('chat.status')}</Text>
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
});
