import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import { Instrument_Sans } from "next/font/google";
import "./globals.css";

/**
 * Real-user Web Vitals (spec 4.10) through Vercel Speed Insights, only in builds made for
 * Vercel: elsewhere (local, the e2e build) its script would answer 404.
 */
const SPEED_INSIGHTS = process.env.VERCEL === "1";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Generation Feed", template: "%s · Generation Feed" },
  description: "A gallery of AI-generated images and short videos.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${instrumentSans.variable} h-full antialiased`}>
      <body className="min-h-full bg-bg font-sans text-base text-fg">
        {children}
        {SPEED_INSIGHTS && <SpeedInsights />}
      </body>
    </html>
  );
}
