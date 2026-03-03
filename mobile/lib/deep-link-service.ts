import * as Linking from 'expo-linking';
import { router } from 'expo-router';

export class DeepLinkService {
  /**
   * Initialize deep linking
   */
  static initialize(): void {
    // Handle initial URL if app was opened via deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        this.handleUrl(url);
      }
    });

    // Listen for deep link events
    Linking.addEventListener('url', (event) => {
      this.handleUrl(event.url);
    });
  }

  /**
   * Handle deep link URL
   */
  private static handleUrl(url: string): void {
    const { hostname, path, queryParams } = Linking.parse(url);

    // Handle different deep link patterns
    if (hostname === 'history' && path) {
      // oceanai://history/[groupId]
      const groupId = path.replace('/', '');
      router.push(`/history/${groupId}` as any);
    } else if (hostname === 'profile') {
      // oceanai://profile
      router.push('/profile/edit' as any);
    } else if (hostname === 'chat' && queryParams?.groupId) {
      // oceanai://chat?groupId=xxx
      router.push({
        pathname: '/chat',
        params: { groupId: queryParams.groupId as string },
      } as any);
    }
  }

  /**
   * Open Telegram bot with location
   */
  static async openTelegramBot(
    latitude: number,
    longitude: number,
    userId: string
  ): Promise<void> {
    const botUsername = 'OceanAICompanionBot';
    const startParam = `loc_${latitude}_${longitude}_${userId}`;
    const telegramUrl = `https://t.me/${botUsername}?start=${startParam}`;

    const canOpen = await Linking.canOpenURL(telegramUrl);
    if (canOpen) {
      await Linking.openURL(telegramUrl);
    } else {
      // Fallback to web version
      await Linking.openURL(`https://t.me/${botUsername}`);
    }
  }

  /**
   * Open external map app
   */
  static async openMap(latitude: number, longitude: number): Promise<void> {
    const url = `https://maps.google.com/?q=${latitude},${longitude}`;
    await Linking.openURL(url);
  }

  /**
   * Open URL in browser
   */
  static async openUrl(url: string): Promise<void> {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      throw new Error('Cannot open URL');
    }
  }
}
