import './globals.css';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export const metadata = {
  title: 'Fake Job Detection | AI-Powered Job Scam Analyzer',
  description:
    'Detect fraudulent job postings, recruitment scams, and phishing attempts using Google Gemini AI and real-time pattern analysis.',
  keywords: ['fake job detection', 'job scam detector', 'gemini ai', 'cybersecurity', 'employment scam'],
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body className="bg-slate-950 text-slate-100 min-h-screen flex flex-col antialiased selection:bg-emerald-500 selection:text-slate-950 overflow-x-hidden">
        <Navbar />
        <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
