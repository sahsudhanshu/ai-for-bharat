/**
 * Chat Stream Client for Server-Sent Events (SSE)
 * Handles streaming chat responses from the Agent API with proper error handling and fallback
 *
 * Enhanced with:
 * - Comprehensive error handling with user-friendly messages
 * - Retry logic with exponential backoff for transient failures
 * - Location context passing when available
 * - Detailed error logging for debugging
 */

import { AGENT_BASE_URL, IS_AGENT_CONFIGURED } from "./constants";
import { ApiError } from "./api-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { retryWithBackoff, RETRY_PRESETS } from "./retry-utils";

export interface StreamMessage {
  type: "token" | "done" | "error";
  content?: string;
  error?: string;
}

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

/**
 * ChatStreamClient handles SSE streaming for real-time chat responses
 */
export class ChatStreamClient {
  private abortController: AbortController | null = null;
  private isStreaming = false;

  /**
   * Get authentication token from AsyncStorage
   */
  private async getToken(): Promise<string> {
    try {
      const token = await AsyncStorage.getItem("ocean_ai_token");
      if (!token) {
        throw new Error("No authentication token found");
      }
      return token;
    } catch (error) {
      console.error("Failed to retrieve token:", error);
      throw new Error("Authentication required");
    }
  }

  /**
   * Build the streaming URL with query parameters
   */
  private buildStreamUrl(options: StreamOptions): string {
    const {
      conversationId,
      message,
      language,
      location,
      replyToMessageId,
      analysisId,
    } = options;
    const url = new URL(`${AGENT_BASE_URL}/chat/stream`);

    if (conversationId) {
      url.searchParams.set("conversationId", conversationId);
    }
    url.searchParams.set("message", message);

    if (language) {
      url.searchParams.set("language", language);
    }

    if (location) {
      url.searchParams.set(
        "location",
        `${location.latitude},${location.longitude}`,
      );
    }

    if (replyToMessageId) {
      url.searchParams.set("replyToMessageId", replyToMessageId);
    }

    if (analysisId) {
      url.searchParams.set("analysisId", analysisId);
    }

    return url.toString();
  }

  /**
   * Parse SSE data line
   */
  private parseSSELine(line: string): StreamMessage | null {
    // SSE format: "data: {json}"
    if (!line.startsWith("data: ")) {
      return null;
    }

    const dataStr = line.substring(6).trim();
    if (!dataStr) {
      return null;
    }

    try {
      return JSON.parse(dataStr) as StreamMessage;
    } catch (error) {
      console.warn("Failed to parse SSE line:", line, error);
      return null;
    }
  }

  /**
   * Process SSE stream from response
   */
  private async processStream(
    response: Response,
    options: StreamOptions,
  ): Promise<void> {
    const { onToken, onComplete, onError } = options;

    if (!response.body) {
      throw new Error("Response body is null");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (this.isStreaming) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        // Decode chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;

          const message = this.parseSSELine(trimmedLine);
          if (!message) continue;

          if (message.type === "token" && message.content) {
            onToken?.(message.content);
          } else if (message.type === "done") {
            onComplete?.();
            this.isStreaming = false;
            break;
          } else if (message.type === "error") {
            const error = new Error(message.error || "Stream error");
            onError?.(error);
            this.isStreaming = false;
            break;
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        // Stream was stopped by user
        console.log("Stream aborted by user");
      } else {
        console.error("Stream processing error:", error);
        onError?.(error as Error);
      }
    } finally {
      reader.releaseLock();
      this.isStreaming = false;
    }
  }

  /**
   * Initiate streaming request with retry logic
   */
  private async initiateStream(options: StreamOptions): Promise<Response> {
    const token = await this.getToken();
    const url = this.buildStreamUrl(options);

    return retryWithBackoff(
      async () => {
        const response = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "text/event-stream",
            "Cache-Control": "no-cache",
          },
          signal: this.abortController?.signal,
        });

        if (!response.ok) {
          let errorMessage = `Stream request failed: ${response.status}`;
          try {
            const errorBody = await response.json();
            errorMessage = errorBody.message || errorBody.error || errorMessage;
          } catch {
            // Ignore JSON parse errors
          }
          throw new ApiError(response.status, errorMessage);
        }

        return response;
      },
      {
        ...RETRY_PRESETS.FAST,
        onRetry: (attempt, error) => {
          console.log(
            `Retrying stream connection (attempt ${attempt}):`,
            error.message,
          );
        },
      },
    );
  }

  /**
   * Stream a chat message with SSE
   * Returns a promise that resolves when streaming completes
   *
   * Enhanced with:
   * - Retry logic for connection failures
   * - Better error messages
   * - Location context passing
   */
  async streamMessage(options: StreamOptions): Promise<void> {
    if (!IS_AGENT_CONFIGURED) {
      throw new ApiError(
        0,
        "Agent API is not configured. Set EXPO_PUBLIC_AGENT_URL to enable streaming.",
      );
    }

    if (!options.message || !options.message.trim()) {
      throw new ApiError(400, "Message is required");
    }

    if (this.isStreaming) {
      throw new Error("Already streaming a message");
    }

    this.isStreaming = true;
    this.abortController = new AbortController();

    try {
      const response = await this.initiateStream(options);
      await this.processStream(response, options);
    } catch (error) {
      this.isStreaming = false;

      if (error instanceof Error && error.name === "AbortError") {
        // User stopped streaming, not an error
        console.log("Streaming stopped by user");
        return;
      }

      console.error("Streaming error:", error);
      options.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * Stop the current streaming operation
   */
  stopStreaming(): void {
    if (this.abortController && this.isStreaming) {
      this.abortController.abort();
      this.abortController = null;
      this.isStreaming = false;
    }
  }

  /**
   * Check if currently streaming
   */
  getIsStreaming(): boolean {
    return this.isStreaming;
  }
}

/**
 * Singleton instance for app-wide use
 */
export const chatStreamClient = new ChatStreamClient();
