import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "냉장고를 부탁해",
  description:
    "냉장고 사진을 올리면 AI가 식재료를 인식하고 레시피를 추천하며, 마음에 든 레시피를 계정에 저장할 수 있습니다.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
