import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { I18nProvider } from "@/lib/i18n/context";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const fontMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Layerflow — find the bug, keep the skill",
  description:
    "Layerflow is a coding coach for beginner Python programmers: it runs your code safely, explains failures in plain language, and gives hints that sharpen without ever revealing the answer.",
  openGraph: {
    title: "Layerflow — find the bug, keep the skill",
    description: "A coding coach that helps you find the bug without handing you the answer.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("antialiased", fontMono.variable, inter.variable)}>
      <body className="bg-neutral-50 text-neutral-950 font-sans selection:bg-neutral-900 selection:text-white">
        <ThemeProvider>
          <I18nProvider>{children}</I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
