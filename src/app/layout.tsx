import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "YouTube Media",
  description: "Convert YouTube links into downloadable MP4 and MP3 files.",
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
