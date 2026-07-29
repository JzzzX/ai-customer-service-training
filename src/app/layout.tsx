import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "AI 客服训练",
  description: "宠物食品客服新人的知识学习与情景对练应用",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
