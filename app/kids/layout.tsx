import type { Metadata } from "next";

export const metadata: Metadata = { title: "Kids" };

export default function KidsLayout({ children }: { children: React.ReactNode }) {
  return <div className="kiosk paper-texture">{children}</div>;
}
