import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://jrjr.pl";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "jrjr.pl — Łatwogang x Bedoes x Cancer Fighters",
    template: "%s — jrjr.pl",
  },
  description:
    "Nieoficjalna strona akcji charytatywnej: dziewięć dni transmisji Łatwogang na rzecz Fundacji Cancer Fighters. Śledź licznik wpłat na żywo i poznaj gości.",
  keywords: [
    "Łatwogang",
    "Bedoes",
    "Cancer Fighters",
    "charytatywna zbiórka",
    "stream",
    "9 dni",
    "Maja Bedoes",
  ],
  openGraph: {
    title: "jrjr.pl — Łatwogang x Bedoes x Cancer Fighters",
    description:
      "Dziewięć dni transmisji, jeden utwór, jeden cel: pomoc dzieciom chorym na raka.",
    url: siteUrl,
    siteName: "jrjr.pl",
    locale: "pl_PL",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "jrjr.pl — Łatwogang x Bedoes x Cancer Fighters",
    description:
      "Dziewięć dni transmisji, jeden utwór, jeden cel: pomoc dzieciom chorym na raka.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pl">
      <head>
        <link rel="preconnect" href="https://rsms.me/" />
        <link
          rel="stylesheet"
          href="https://rsms.me/inter/inter.css"
          crossOrigin="anonymous"
        />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
