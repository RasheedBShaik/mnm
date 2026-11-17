
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "MNM AI Classifier | Intelligent Maintenance Management",
    template: "%s | MNM AI Classifier",
  },
  description:
    "MNM AI Classifier uses Google BERT and Natural Language Processing to automatically classify maintenance complaints into six categories: Civil, Security, HVAC, Plumbing, Electricity, and Appliances.",
  keywords: [
    "MNM AI Classifier",
    "Maintenance Complaint Classification",
    "Artificial Intelligence",
    "Natural Language Processing",
    "Google BERT",
    "Machine Learning",
    "Text Classification",
    "FastAPI",
    "Next.js",
  ],
  applicationName: "MNM AI Classifier",
  authors: [{ name: "Rasheed Basha" }],
  openGraph: {
    title: "MNM AI Classifier",
    description:
      "Intelligent maintenance complaint classification powered by Google BERT and NLP.",
    type: "website",
    url: "https://mnm-mu.vercel.app/",
    siteName: "MNM AI Classifier",
  },
  twitter: {
    card: "summary_large_image",
    title: "MNM AI Classifier",
    description:
      "Classify maintenance complaints intelligently using Google BERT and NLP.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
