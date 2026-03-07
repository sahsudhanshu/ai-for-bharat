/**
 * Chat Stream Client — SSE streaming from the Agent API.
 *
 * Uses the actual agent endpoint:
 *   POST /conversations/{id}/messages/stream
 *
 * The agent streams back Server-Sent Events in the format:
 *   data: {"type":"chunk","text":"..."}   — LLM token
 *   data: {"type":"tool","name":"..."}    — tool call (informational)
 *   data: {"type":"end","messageId":"..."}  — stream complete
 *   data: {"type":"error","error":"..."}  — error
 *
 * NOTE: React Native's fetch polyfill does NOT expose response.body as a
 * ReadableStream, so we use XMLHttpRequest with onprogress which React Native
 * does support for incremental / streaming reads.
 */

import { AGENT_BASE_URL, IS_AGENT_CONFIGURED } from "./constants";
import { ApiError } from "./api-client";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface StreamOptions {
  conversationId?: string;
  message: string;
  language?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  replyToMessageId?: string;
  analysisId?: string;
  onToken?: (token: string) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

class ChatStreamClient {
  private xhr: XMLHttpRequest | null = null;
  private isStreaming = false;

  private async getToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem("ocean_ai_token");
    } catch {
      return null;
    }
  }

  streamMessage(options: StreamOptions): Promise<void> {
    if (!IS_AGENT_CONFIGURED) {
      return Promise.reject(
        new ApiError(
          0,
          "Agent API is not configured. Set EXPO_PUBLIC_AGENT_URL to enable streaming.",
        ),
      );
    }

    const {
      conversationId,
      message,
      language,
      location,
      onToken,
      onComplete,
      onError,
    } = options;

    if (!conversationId) {
      return Promise.reject(
        new ApiError(400, "conversationId is required for streaming"),
      );
    }

    if (this.isStreaming) {
      this.stopStreaming();
    }

    this.isStreaming = true;

    return new Promise(async (resolve, reject) => {
      const token = await this.getToken();
      const url = `${AGENT_BASE_URL}/conversations/${conversationId}/messages/stream`;

      const xhr = new XMLHttpRequest();
      this.xhr = xhr;

      let processedLength = 0;
      let buffer = "";

      const processChunk = (newText: string) => {
        buffer += newText;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "chunk" && data.text) {
              onToken?.(data.text);
            } else if (data.type === "end") {
              this.isStreaming = false;
              onComplete?.();
              resolve();
            } else if (data.type === "error") {
              const err = new Error(data.error || "Stream error");
              this.isStreaming = false;
              onError?.(err);
              reject(err);
            }
            // "tool" events are silently ignored
          } catch (e) {
            if (!(e instanceof SyntaxError)) {
              this.isStreaming = false;
              onError?.(e as Error);
              reject(e);
            }
          }
        }
      };

      xhr.open("POST", url, true);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.setRequestHeader("Accept", "text/event-stream");
      if (token) {
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      }

      xhr.onprogress = () => {
        if (!this.isStreaming) return;
        const newText = xhr.responseText.slice(processedLength);
        processedLength = xhr.responseText.length;
        if (newText) processChunk(newText);
      };

      xhr.onload = () => {
        // Flush any remaining buffered text
        const newText = xhr.responseText.slice(processedLength);
        if (newText) processChunk(newText);

        if (this.isStreaming) {
          // Stream finished without an explicit "end" event
          this.isStreaming = false;
          onComplete?.();
          resolve();
        }
      };

      xhr.onerror = () => {
        this.isStreaming = false;
        const err = new ApiError(0, "Stream network error");
        onError?.(err);
        reject(err);
      };

      xhr.onabort = () => {
        this.isStreaming = false;
        resolve(); // user-initiated stop, not an error
      };

      if ((xhr.status !== 0 && xhr.status < 200) || xhr.status >= 300) {
        this.isStreaming = false;
        const err = new ApiError(
          xhr.status,
          `Stream request failed: ${xhr.status}`,
        );
        onError?.(err);
        reject(err);
        return;
      }

      console.log("----------------------------------------");
      console.log("🚀 SENDING PROMPT TO AGENT:");
      console.log(`💬 Message: ${message}`);
      console.log(`🌐 Language: ${language}`);
      console.log(`📍 Location: ${location?.latitude}, ${location?.longitude}`);
      console.log(`🆔 Conv ID: ${conversationId}`);

      const requestBody = {
        message,
        language,
        latitude: location?.latitude,
        longitude: location?.longitude,
      };
      console.log("📦 JSON Body:", JSON.stringify(requestBody, null, 2));
      console.log("----------------------------------------");

      xhr.send(JSON.stringify(requestBody));
    });
  }

  stopStreaming(): void {
    if (this.xhr) {
      this.xhr.abort();
      this.xhr = null;
    }
    this.isStreaming = false;
  }

  getIsStreaming(): boolean {
    return this.isStreaming;
  }
}

export const chatStreamClient = new ChatStreamClient();
