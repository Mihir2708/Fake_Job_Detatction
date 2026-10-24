'use client';

import React, { useState, useEffect } from 'react';
import { Activity, CheckCircle2, AlertTriangle, RefreshCw, Server, Database, Key, ChevronDown, ChevronUp } from 'lucide-react';

export default function HealthStatus() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      const res = await fetch(`${apiUrl}/health`);
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const json = await res.json();
      setHealth(json.data || json);
    } catch (err) {
      setError(err.message || 'Unable to connect to backend server');
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const isHealthy = health && health.status === 'OK' && !error;

  return (
    <div className="rounded-2xl bg-slate-900/40 border border-slate-800/60 backdrop-blur-sm overflow-hidden transition-all w-full">
      {/* Compact Quick Status Bar */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-2.5 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
            {isHealthy && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isHealthy ? 'bg-emerald-500' : error ? 'bg-rose-500' : 'bg-amber-500'}`}></span>
          </span>
          <span className="text-xs font-medium text-slate-300 truncate">
            {isHealthy ? 'Verification Engine Online' : error ? 'Connecting...' : 'Checking Service...'}
          </span>
          <span className="hidden md:inline-block text-slate-600">•</span>
          <span className="hidden md:inline-block text-[11px] text-slate-400 truncate">
            AI & Live Search Ready
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-slate-200 transition-colors px-2 py-1 rounded-lg hover:bg-slate-800/60"
            aria-label="Toggle system details"
          >
            <span>{expanded ? 'Hide' : 'System Info'}</span>
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          <button
            onClick={fetchHealth}
            disabled={loading}
            className="p-1 sm:p-1.5 rounded-lg hover:bg-slate-800/60 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
            title="Refresh system status"
            aria-label="Refresh status"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Expanded Details View */}
      {expanded && (
        <div className="px-3 sm:px-4 pb-3.5 pt-2 border-t border-slate-800/50 bg-slate-950/40 space-y-2.5">
          {error && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="font-semibold">Backend Server Connecting</p>
                <p className="text-amber-200/80 text-[11px] break-words">{error}</p>
              </div>
            </div>
          )}

          {health && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/70 flex items-center gap-2.5">
                <Server className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] text-slate-400">Server</div>
                  <div className="text-xs font-semibold text-emerald-400 truncate">{health.status || 'Active'}</div>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/70 flex items-center gap-2.5">
                <Database className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] text-slate-400">Database</div>
                  <div className="text-xs font-semibold text-slate-200 capitalize truncate">{health.database || 'Connecting'}</div>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/70 flex items-center gap-2.5">
                <Key className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-[10px] text-slate-400">Gemini AI</div>
                  <div className="text-xs font-semibold text-slate-200 truncate">
                    {health.geminiConfigured ? <span className="text-emerald-400">Ready</span> : <span className="text-amber-400">Not configured</span>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
