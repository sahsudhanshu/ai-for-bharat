import React, { useState, useEffect, useRef } from "react";
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
  Modal,
  Animated,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONTS, SPACING, RADIUS } from "../../lib/constants";
import { useAuth } from "../../lib/auth-context";
import { useLanguage } from "../../lib/i18n";
import { useNetwork } from "../../lib/network-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useNavigation } from "expo-router";
import * as Speech from "expo-speech";
import { Audio } from "expo-av";
import { synthesizeSpeech } from "../../lib/api-client";
import Markdown from "react-native-markdown-display";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface UIMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: Date;
}

export default function ChatScreen() {
  const { user } = useAuth();
  const { t, locale, speechCode, isLoaded } = useLanguage();
  const { effectiveMode, connectionQuality } = useNetwork();
  const params = useLocalSearchParams();
  const navigation = useNavigation();

  const QUICK_ACTIONS = [
    t("chat.actionFishToday"),
    t("chat.actionMarketPrices"),
    t("chat.actionOceanConditions"),
    t("chat.actionSustainability"),
    t("chat.actionRegulations"),
    t("chat.actionTips"),
  ];

  const [messages, setMessages] = useState<UIMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: t("chat.welcome"),
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [chats, setChats] = useState<{ id: string; title: string }[]>([]);
  const [showSidebar, setShowSidebar] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const initialMessageSent = useRef(false);
  const sidebarAnim = useRef(new Animated.Value(-SCREEN_WIDTH * 0.75)).current;

  // Reset initial message flag when component unmounts or chat changes
  useEffect(() => {
    return () => {
      initialMessageSent.current = false;
    };
  }, [currentChatId]);

  useEffect(() => {
    // Reset to new chat when tab is focused
    const unsubscribe = navigation.addListener("focus", () => {
      if (!params.initialMessage) {
        createNewChat();
      }
    });

    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (params.initialMessage && !initialMessageSent.current) {
      initialMessageSent.current = true;
      setCurrentChatId(null);
      setMessages([]);
      setTimeout(() => {
        sendMessage(params.initialMessage as string);
      }, 500);
    }
  }, [params]);

  useEffect(() => {
    import("../../lib/api-client").then((m) => {
      m.getConversationsList()
        .then((res) => {
          setChats(res.map((c) => ({ id: c.conversationId, title: c.title })));
          if (res.length > 0 && !params.initialMessage) {
            loadChat(res[0].conversationId);
          }
        })
        .catch(console.warn);
    });
  }, []);

  useEffect(() => {
    Animated.timing(sidebarAnim, {
      toValue: showSidebar ? 0 : -SCREEN_WIDTH * 0.75,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [showSidebar]);

  const speakMessage = async (text: string) => {
    if (isSpeaking) {
      if (sound) {
        await sound.stopAsync();
        await sound.unloadAsync();
        setSound(null);
      }
      setIsSpeaking(false);
      return;
    }

    setIsSpeaking(true);
    try {
      const res = await synthesizeSpeech(text, speechCode || "en-IN");
      if (res.audioBase64) {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: `data:audio/mp3;base64,${res.audioBase64}` },
          { shouldPlay: true },
        );
        setSound(newSound);
        newSound.setOnPlaybackStatusUpdate((status: any) => {
          if (status.isLoaded && status.didJustFinish) {
            setIsSpeaking(false);
            newSound.unloadAsync();
            setSound(null);
          }
        });
      } else {
        setIsSpeaking(false);
      }
    } catch (error) {
      console.warn("TTS Error:", error);
      setIsSpeaking(false);
    }
  };

  useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  const loadChat = async (chatId: string) => {
    setCurrentChatId(chatId);
    setShowSidebar(false);
    setMessages([]);
    setIsTyping(true);
    if (sound) {
      sound.unloadAsync();
      setSound(null);
    }
    setIsSpeaking(false);
    try {
      const { getChatHistory } = await import("../../lib/api-client");
      const history = await getChatHistory(50, chatId);
      const formatted = history.map((msg) => ({
        id: msg.id,
        role: msg.role as "user" | "assistant",
        text: msg.text,
        timestamp: new Date(msg.timestamp),
      }));
      setMessages(
        formatted.length > 0
          ? formatted
          : [
              {
                id: "welcome",
                role: "assistant",
                text: t("chat.welcome"),
                timestamp: new Date(),
              },
            ],
      );
    } catch (e) {
      console.warn(e);
    } finally {
      setIsTyping(false);
    }
  };

  const createNewChat = () => {
    setCurrentChatId(null);
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        text: t("chat.welcome"),
        timestamp: new Date(),
      },
    ]);
    setShowSidebar(false);
    Speech.stop();
    setIsSpeaking(false);
  };

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;

    Speech.stop();
    setIsSpeaking(false);
    setInputText("");
    Keyboard.dismiss();

    const userMsg: UIMessage = {
      id: `user_${Date.now()}`,
      role: "user",
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
          const { createConversation } = await import("../../lib/api-client");
          const newConv = await createConversation(
            trimmed.substring(0, 40),
            locale,
          );
          targetChatId = newConv.conversationId;
          setCurrentChatId(targetChatId);
          if (targetChatId) {
            setChats((prev) => [
              { id: targetChatId as string, title: trimmed.substring(0, 40) },
              ...prev,
            ]);
          }
        } catch (e) {
          console.warn("Failed to explicitly create conversation", e);
        }
      }

      const { sendChat } = await import("../../lib/api-client");
      const res = await sendChat(trimmed, targetChatId ?? undefined, locale);

      if (!targetChatId && res.chatId) {
        setCurrentChatId(res.chatId);
        setChats((prev) => [{ id: res.chatId, title: trimmed }, ...prev]);
      }
      const botMsg: UIMessage = {
        id: `bot_${Date.now()}`,
        role: "assistant",
        text: res.response,
        timestamp: new Date(res.timestamp),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: "assistant",
          text: t("common.error"),
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsTyping(false);
      setTimeout(
        () => flatListRef.current?.scrollToEnd({ animated: true }),
        150,
      );
    }
  };

  const renderMessage = ({ item }: { item: UIMessage }) => {
    const isUser = item.role === "user";
    return (
      <View style={[styles.messageRow, isUser && styles.messageRowUser]}>
        {!isUser && (
          <View style={styles.avatar}>
            <Ionicons
              name="hardware-chip-outline"
              size={18}
              color={COLORS.primaryLight}
            />
          </View>
        )}
        <View
          style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}
        >
          {isUser ? (
            <Text style={[styles.bubbleText, styles.bubbleTextUser]}>
              {item.text}
            </Text>
          ) : (
            <Markdown style={markdownStyles}>{item.text}</Markdown>
          )}
          <View style={styles.bubbleFooter}>
            {!isUser && (
              <TouchableOpacity
                onPress={() => speakMessage(item.text)}
                style={styles.ttsBtn}
              >
                <Ionicons
                  name={isSpeaking ? "volume-mute" : "volume-high"}
                  size={14}
                  color={COLORS.primaryLight}
                />
              </TouchableOpacity>
            )}
            <Text style={[styles.bubbleTime, isUser && styles.bubbleTimeUser]}>
              {item.timestamp.toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>
        </View>
        {isUser && (
          <View style={[styles.avatar, styles.avatarUser]}>
            <Text style={styles.avatarText}>
              {(user?.name ?? "U")[0].toUpperCase()}
            </Text>
          </View>
        )}
      </View>
    );
  };

  if (!isLoaded) return null;

  return (
    <SafeAreaView style={styles.safe}>
      {effectiveMode === "offline" && (
        <View style={styles.offlineOverlay}>
          <View style={styles.offlineCard}>
            <Ionicons
              name={
                connectionQuality === "poor"
                  ? "speedometer-outline"
                  : "cloud-offline"
              }
              size={48}
              color={COLORS.warning}
            />
            <Text style={styles.offlineTitle}>
              {connectionQuality === "poor"
                ? "Slow Connection"
                : "No Internet Connection"}
            </Text>
            <Text style={styles.offlineText}>
              {connectionQuality === "poor"
                ? "AI Assistant requires a stable internet connection."
                : "AI Assistant requires an active internet connection to function."}
            </Text>
          </View>
        </View>
      )}

      {/* Sidebar Modal */}
      <Modal
        visible={showSidebar}
        transparent
        animationType="none"
        onRequestClose={() => setShowSidebar(false)}
      >
        <TouchableOpacity
          style={styles.sidebarOverlay}
          activeOpacity={1}
          onPress={() => setShowSidebar(false)}
        >
          <Animated.View
            style={[
              styles.sidebar,
              { transform: [{ translateX: sidebarAnim }] },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.sidebarHeader}>
              <Text style={styles.sidebarTitle}>Chat History</Text>
              <TouchableOpacity onPress={() => setShowSidebar(false)}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.newChatBtn} onPress={createNewChat}>
              <Ionicons name="add-circle" size={20} color="#fff" />
              <Text style={styles.newChatText}>New Chat</Text>
            </TouchableOpacity>

            <ScrollView
              style={styles.chatListScroll}
              showsVerticalScrollIndicator={false}
            >
              {chats.map((chat) => (
                <TouchableOpacity
                  key={chat.id}
                  style={[
                    styles.chatListItem,
                    currentChatId === chat.id && styles.chatListItemActive,
                  ]}
                  onPress={() => loadChat(chat.id)}
                >
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={18}
                    color={
                      currentChatId === chat.id
                        ? COLORS.primaryLight
                        : COLORS.textMuted
                    }
                  />
                  <Text
                    style={[
                      styles.chatListText,
                      currentChatId === chat.id && styles.chatListTextActive,
                    ]}
                    numberOfLines={2}
                  >
                    {chat.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>
        </TouchableOpacity>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => setShowSidebar(true)}
          style={styles.menuBtn}
        >
          <Ionicons name="menu" size={28} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Ionicons
            name="hardware-chip-outline"
            size={24}
            color={COLORS.primaryLight}
          />
          <View>
            <Text style={styles.headerTitle}>
              {currentChatId
                ? chats.find((c) => c.id === currentChatId)?.title ||
                  "OceanAI Assistant"
                : "New Chat"}
            </Text>
            <View style={styles.onlineRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>{t("chat.status")}</Text>
            </View>
          </View>
        </View>
        <View style={{ width: 28 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
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
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
        />

        {/* Typing Indicator */}
        {isTyping && (
          <View style={styles.typingRow}>
            <View style={styles.avatar}>
              <Ionicons
                name="hardware-chip-outline"
                size={18}
                color={COLORS.primaryLight}
              />
            </View>
            <View style={styles.typingBubble}>
              <ActivityIndicator size="small" color={COLORS.primaryLight} />
              <Text style={styles.typingText}>{t("chat.typing")}</Text>
            </View>
          </View>
        )}

        {/* Quick Actions */}
        {messages.length <= 1 && (
          <View style={styles.quickActionsWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickActionsScroll}
              keyboardShouldPersistTaps="always"
            >
              {QUICK_ACTIONS.map((action) => (
                <TouchableOpacity
                  key={action}
                  style={styles.quickActionChip}
                  onPress={() => sendMessage(action)}
                  activeOpacity={0.7}
                  disabled={isTyping}
                >
                  <Ionicons
                    name="sparkles"
                    size={14}
                    color={COLORS.primaryLight}
                    style={styles.quickActionIcon}
                  />
                  <Text style={styles.quickActionText}>{action}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Input Bar */}
        <View style={styles.inputBar}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder={t("chat.placeholder")}
              placeholderTextColor={COLORS.textSubtle}
              multiline
              maxLength={1000}
              returnKeyType="send"
              onSubmitEditing={() => sendMessage(inputText)}
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                (!inputText.trim() || isTyping) && styles.sendBtnDisabled,
              ]}
              onPress={() => sendMessage(inputText)}
              disabled={!inputText.trim() || isTyping}
              activeOpacity={0.8}
            >
              <Ionicons name="send" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const markdownStyles = StyleSheet.create({
  body: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.sm,
    lineHeight: 22,
  },
  heading1: {
    color: COLORS.textPrimary,
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold as any,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  heading2: {
    color: COLORS.textPrimary,
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold as any,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  heading3: {
    color: COLORS.textPrimary,
    fontSize: FONTS.sizes.md,
    fontWeight: FONTS.weights.semibold as any,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  paragraph: {
    marginTop: 0,
    marginBottom: SPACING.sm,
  },
  strong: {
    fontWeight: FONTS.weights.bold as any,
    color: COLORS.textPrimary,
  },
  em: {
    fontStyle: "italic" as const,
  },
  code_inline: {
    backgroundColor: COLORS.bgDark,
    color: COLORS.primaryLight,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    fontFamily: "monospace",
    fontSize: FONTS.sizes.xs,
  },
  code_block: {
    backgroundColor: COLORS.bgDark,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    marginVertical: SPACING.xs,
    fontFamily: "monospace",
    fontSize: FONTS.sizes.xs,
  },
  fence: {
    backgroundColor: COLORS.bgDark,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    marginVertical: SPACING.xs,
    fontFamily: "monospace",
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
  },
  bullet_list: {
    marginVertical: SPACING.xs,
  },
  ordered_list: {
    marginVertical: SPACING.xs,
  },
  list_item: {
    marginVertical: 2,
  },
  blockquote: {
    backgroundColor: COLORS.bgDark,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primaryLight,
    paddingLeft: SPACING.sm,
    paddingVertical: SPACING.xs,
    marginVertical: SPACING.xs,
  },
  link: {
    color: COLORS.primaryLight,
    textDecorationLine: "underline" as const,
  },
  table: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    marginVertical: SPACING.sm,
  },
  thead: {
    backgroundColor: COLORS.bgDark,
  },
  th: {
    padding: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontWeight: FONTS.weights.bold as any,
  },
  td: {
    padding: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  hr: {
    backgroundColor: COLORS.border,
    height: 1,
    marginVertical: SPACING.md,
  },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bgDark },
  flex: { flex: 1 },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
  },
  menuBtn: {
    padding: SPACING.xs,
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginLeft: SPACING.sm,
  },
  headerTitle: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
  },
  onlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.success,
  },
  onlineText: { fontSize: FONTS.sizes.xs, color: COLORS.textMuted },

  messageList: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
  },

  messageRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
    paddingHorizontal: SPACING.xs,
  },
  messageRowUser: { flexDirection: "row-reverse" },

  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.bgCard,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarUser: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primaryLight,
  },
  avatarText: {
    fontSize: FONTS.sizes.sm,
    color: "#fff",
    fontWeight: FONTS.weights.bold,
  },

  bubble: {
    flex: 1,
    borderRadius: RADIUS["2xl"],
    padding: SPACING.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
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
  bubbleText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
  bubbleTextUser: { color: "#fff" },
  bubbleFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: SPACING.xs,
    gap: SPACING.sm,
  },
  bubbleTime: { fontSize: FONTS.sizes.xs, color: COLORS.textSubtle },
  bubbleTimeUser: { color: "rgba(255,255,255,0.7)" },
  ttsBtn: { padding: 2 },

  typingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  typingBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS["2xl"],
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  typingText: {
    color: COLORS.textMuted,
    fontSize: FONTS.sizes.sm,
  },

  quickActionsWrapper: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
    paddingVertical: SPACING.md,
  },
  quickActionsScroll: {
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  quickActionChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary + "15",
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: COLORS.primary + "40",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.xs,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  quickActionIcon: {
    marginRight: 2,
  },
  quickActionText: {
    color: COLORS.primaryLight,
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semibold,
  },

  inputBar: {
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.bgCard,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: COLORS.bgDark,
    borderRadius: RADIUS["2xl"],
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingLeft: SPACING.base,
    paddingRight: SPACING.xs,
    paddingVertical: SPACING.xs,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  textInput: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingRight: SPACING.sm,
    color: COLORS.textPrimary,
    fontSize: FONTS.sizes.base,
    maxHeight: 120,
    minHeight: 40,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  sendBtnDisabled: { backgroundColor: COLORS.border, opacity: 0.5 },

  sidebarOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  sidebar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: SCREEN_WIDTH * 0.75,
    backgroundColor: COLORS.bgDark,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    paddingTop: SPACING.xl,
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  sidebarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.base,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sidebarTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
  },
  newChatBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    marginHorizontal: SPACING.base,
    marginVertical: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    gap: SPACING.sm,
    justifyContent: "center",
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  newChatText: {
    color: "#fff",
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.bold,
  },
  chatListScroll: {
    flex: 1,
    paddingHorizontal: SPACING.base,
  },
  chatListItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: SPACING.md,
    gap: SPACING.sm,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.xs,
  },
  chatListItemActive: {
    backgroundColor: COLORS.bgCard,
    borderWidth: 1.5,
    borderColor: COLORS.primaryLight,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  chatListText: {
    color: COLORS.textSecondary,
    fontSize: FONTS.sizes.sm,
    flex: 1,
    lineHeight: 20,
  },
  chatListTextActive: {
    color: COLORS.primaryLight,
    fontWeight: FONTS.weights.semibold,
  },

  offlineOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    zIndex: 1000,
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.xl,
  },
  offlineCard: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS["2xl"],
    padding: SPACING["2xl"],
    alignItems: "center",
    maxWidth: 320,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  offlineTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  offlineText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    textAlign: "center",
    lineHeight: 22,
  },
});
