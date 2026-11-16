import type { Metadata } from "next";
import { getHostBrand } from "@/lib/hostBrand";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getHostBrand();
  const isWhiteLabel = brand.isWhiteLabel;
  return {
    title: isWhiteLabel ? `${brand.name} — Panel` : "FitFlow — Gestion de Centros Deportivos",
    description: isWhiteLabel
      ? `Panel de gestión ${brand.name}`
      : "Plataforma SaaS para gestion integral de gimnasios, estudios y centros deportivos",
    icons: {
      icon: [{ url: brand.faviconUrl, type: "image/svg+xml" }],
      shortcut: brand.faviconUrl,
      apple: brand.logoUrl ?? "/logo.svg",
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="h-full font-sans">{children}</body>
    </html>
  );
}
