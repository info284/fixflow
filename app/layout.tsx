// app/layout.tsx
import './globals.css';

export const metadata = {
  title: 'FixFlow',
  description: 'Instant quotes from trusted local trades',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, Arial, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}


