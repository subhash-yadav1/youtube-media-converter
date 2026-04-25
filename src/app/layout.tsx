import type { Metadata } from "next";

import "./globals.css";

export const metadataBase = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://your-domain.com");

export const metadata: Metadata = {
  title: "YouTube Media Converter — Free YouTube to MP4, MP3 & HD Thumbnails",
  description:
    "YouTube Media Converter — Convert YouTube to MP4, MP3, and download HD thumbnails. Fast, free, and easy to use.",
  keywords: [
    "youtube to mp4",
    "youtube to mp3",
    "youtube downloader",
    "youtube thumbnail downloader",
    "youtube thumbnail hd",
    "youtube media converter",
    "free youtube converter",
  ],
  authors: [{ name: "YouTube Media Converter" }],
  openGraph: {
    title: "YouTube Media Converter — Free YouTube to MP4 & MP3",
    description:
      "Convert YouTube to MP4, MP3, and download HD thumbnails. Fast, free, and privacy-focused.",
    url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://your-domain.com",
    siteName: "YouTube Media Converter",
    images: [
      {
        url: "/favicon.svg",
        width: 800,
        height: 600,
        alt: "YouTube Media Converter",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "YouTube Media Converter",
    description: "Convert YouTube to MP4/MP3 and download HD thumbnails.",
    images: ["/favicon.svg"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
