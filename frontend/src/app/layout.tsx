import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mars Pathfinder // 3D Exploration & Mission Planning',
  description: 'Interactive 3D Mars exploration and mission planning platform using real NASA data.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full bg-black text-white">
      <body className="h-full w-full overflow-hidden select-none bg-black">
        {children}
      </body>
    </html>
  );
}
