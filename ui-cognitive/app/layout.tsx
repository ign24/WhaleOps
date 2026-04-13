import type { Metadata } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { DotGridBackground } from "@/components/layout/dot-grid-background";
import { AgentMoodProvider } from "@/contexts/agent-mood-context";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CGN-Agent",
  description: "CGN-Agent por CGN Labs",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${jakarta.variable} ${jetbrainsMono.variable} antialiased`}>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var nk='cgn-agent-theme';var lk='cognitive-theme';var t=localStorage.getItem(nk)||localStorage.getItem(lk);if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}if(localStorage.getItem(lk)&&!localStorage.getItem(nk)){localStorage.setItem(nk,localStorage.getItem(lk));}}catch(e){}})();`,
          }}
        />
        <AgentMoodProvider>
          <DotGridBackground />
          {children}
        </AgentMoodProvider>
      </body>
    </html>
  );
}
