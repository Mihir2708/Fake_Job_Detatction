import React from 'react';
import { ShieldAlert, Database, Cpu, Globe } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-slate-800/80 bg-slate-950/60 mt-20 py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-emerald-400" />
            <span>Fake Job Detection &copy; {new Date().getFullYear()} — Built with Next.js, Express, MongoDB &amp; Gemini AI</span>
          </div>

          <div className="flex items-center gap-6 text-xs text-slate-500">
            <span className="flex items-center gap-1.5 hover:text-slate-300 transition-colors">
              <Globe className="w-3.5 h-3.5" /> Next.js App Router
            </span>
            <span className="flex items-center gap-1.5 hover:text-slate-300 transition-colors">
              <Cpu className="w-3.5 h-3.5" /> Express.js API
            </span>
            <span className="flex items-center gap-1.5 hover:text-slate-300 transition-colors">
              <Database className="w-3.5 h-3.5" /> Mongoose MongoDB
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
