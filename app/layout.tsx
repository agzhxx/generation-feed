import type { Metadata } from "next";
import { Instrument_Sans } from "next/font/google";
import { preconnect } from "react-dom";
import "./globals.css";

const MEDIA_ORIGIN = process.env.NEXT_PUBLIC_MEDIA_ORIGIN;

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Generation Feed",
  description: "A gallery of AI-generated images and short videos.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // Opens the connection to the media origin while the HTML is still arriving (spec 4.3).
  if (MEDIA_ORIGIN) preconnect(MEDIA_ORIGIN);
  return (
    <html lang="en" className={`${instrumentSans.variable} h-full antialiased`}>
      <body className="min-h-full bg-bg font-sans text-base text-fg">
        {children}
      </body>
    </html>
  );
}
