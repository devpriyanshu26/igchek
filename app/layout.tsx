import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "IG Status Checker — blocked, deactivated, or deleted?",
  description:
    "Check whether an Instagram account is publicly findable, then compare it with your own logged-in view to tell a block apart from deactivation or deletion.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
