import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";
import { TopNav } from "@/components/layout/top-nav";
import { ThemeProvider } from "@/providers/theme-provider";
import { NavWidthProvider } from "@/contexts/nav-width-context";
import { cn } from "@/lib/utils";
import { getSiteUrl } from "@/lib/site-config";
import "./globals.css";
import "@docsearch/css";

const openSans = Open_Sans({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "OpenTimelineIO - Open Timeline Interchange Format",
  description:
    "OpenTimelineIO is an open-source interchange format and API for editorial timeline information, facilitating collaboration and interoperability among various post-production tools.",
  keywords: ["timeline", "editorial", "video", "post-production", "interchange", "format", "OTIO", "open source"],
  metadataBase: new URL(getSiteUrl()),
  openGraph: {
    title: "OpenTimelineIO - Open Timeline Interchange Format",
    description: "An open-source interchange format and API for editorial timeline information.",
    type: "website",
    url: getSiteUrl(),
    siteName: "OpenTimelineIO",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "OpenTimelineIO - Open Timeline Interchange Format",
    description: "An open-source interchange format and API for editorial timeline information.",
    creator: "@OpenTimelineIO",
  },
  icons: {
    icon: [
      { url: '/icons/open-timeline-io-icon-color.svg', type: 'image/svg+xml' },
      { url: '/icons/open-timeline-io-icon-color.png', type: 'image/png' },
    ],
    apple: '/icons/open-timeline-io-icon-color.png',
    shortcut: '/icons/open-timeline-io-icon-color.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn("min-h-dvh bg-background text-foreground antialiased", openSans.className)}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          disableTransitionOnChange={false}
        >
          <NavWidthProvider>
          <div className="flex flex-col min-h-dvh">
            <TopNav />
            <main className="flex-1 flex flex-col">
              {children}
            </main>
          </div>
          </NavWidthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
