import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ذكاء السيرة - منشئ السير الذاتية الذكي",
  description: "أنشئ سيرتك الذاتية بمساعدة الذكاء الاصطناعي بجودة عالمية",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body className="antialiased font-arabic">
        {children}
      </body>
    </html>
  );
}
