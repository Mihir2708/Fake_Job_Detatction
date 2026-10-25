'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function Error({ error, reset }) {
  useEffect(() => {
    // Log error for debugging
    console.error('Application runtime error:', error);
  }, [error]);

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center text-center px-4 py-12">
      <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4">
        <AlertTriangle className="w-7 h-7" />
      </div>
      <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
      <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
        An unexpected error occurred while processing this request. Please try again.
      </p>
      <button
        onClick={() => reset()}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm font-semibold text-slate-200 hover:bg-slate-800 transition-colors"
      >
        <RefreshCw className="w-4 h-4" />
        <span>Try Again</span>
      </button>
    </div>
  );
}
