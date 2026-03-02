import type { Metadata } from "next";
import { Poppins, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { VisualEditsMessenger } from "orchids-visual-edits";
import AppLayout from "@/components/layout/AppLayout";
import { AuthProvider } from "@/lib/auth-context";
import { LanguageProvider } from "@/lib/i18n";
import { Toaster } from "@/components/ui/sonner";

const poppins = Poppins({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OceanAI - AI for Bharat Fisherman Dashboard",
  description: "Advanced AI dashboard for fish identification, weight estimation, and ocean insights.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${poppins.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        <LanguageProvider>
          <AuthProvider>
            <AppLayout>
              {children}
            </AppLayout>
            <Toaster position="top-right" />
          </AuthProvider>
        </LanguageProvider>
        <VisualEditsMessenger />
      </body>
    </html>
  );
}
