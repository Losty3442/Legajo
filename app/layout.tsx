import type { Metadata } from "next";
import "./globals.css";
import { AppFrame } from "@/src/presentation/workspace";
export const metadata: Metadata = {
  title: "Legajo UNP · Gestión docente",
  description: "Prototipo académico de legajo y promoción docente.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg"
  }
};
export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <html lang="es"><body className="antialiased"><AppFrame>{children}</AppFrame></body></html>;
}
