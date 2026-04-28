import { Toaster } from 'react-hot-toast';
import './globals.css';

export const metadata = {
  title: '🏃‍♂️ TakboTracker - Running App',
  description: 'Subaybayan ang iyong pagtakbo gamit ang GPS tracking at Supabase',
  manifest: '/manifest.json',
  themeColor: '#667eea',
};

export default function RootLayout({ children }) {
  return (
    <html lang="tl">
      <body>
        {children}
        <Toaster 
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              borderRadius: '10px',
              background: '#333',
              color: '#fff',
            },
          }}
        />
      </body>
    </html>
  );
}