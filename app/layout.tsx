import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bookline",
  description: "Appointment booking for a single host.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg font-sans text-fg antialiased">
        {children}
      </body>
    </html>
  );
}
