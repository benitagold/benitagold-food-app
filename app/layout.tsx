import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "برنامه غذایی روزانه بنیتاگلد",
  description: "ثبت و ارسال تعداد غذای روزانه گالری و دفتر بنیتاگلد",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
  className="font-vazir text-ink antialiased"
  style={{
    backgroundImage: "url('/bg-tile.png')",
    backgroundRepeat: "repeat",
    backgroundSize: "300px",
  }}
>
  {children}
</body>
    </html>
  );
}
