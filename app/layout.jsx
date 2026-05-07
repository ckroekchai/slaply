import "./globals.css";

export const metadata = {
  metadataBase: new URL("https://slaply.co"),
  title: "Slaply - Instant AI Packaging Audit",
  description:
    "Upload one packaging artwork image and get an AI visual review before production, launch, or marketplace listing."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
