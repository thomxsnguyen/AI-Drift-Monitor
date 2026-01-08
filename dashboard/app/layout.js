export const metadata = {
  title: "AI Drift Monitor",
  description: "Real-time ML model drift detection dashboard",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
