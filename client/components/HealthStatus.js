'use client';

import React, { useState, useEffect } from 'react';
import { Activity, CheckCircle2, AlertTriangle, RefreshCw, Server, Database, Key } from 'lucide-react';

export default function HealthStatus() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-base">Backend Health Monitor</h3>
            <p className="text-xs text-slate-400">Live check on GET /api/health endpoint</p>
          </div>
        </div>

        <button
          onClick={fetchHealth}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors disabled:opacity-50 border border-slate-700"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Pinging...' : 'Refresh'}</span>
        </button>
      </div>

      {loading && !health && (
        <div className="py-6 text-center text-sm text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-400" />
          Checking server status at /api/health...
        </div>
      )}

      {error && !loading && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold mb-1">Backend Server Not Responding</p>
            <p className="text-amber-200/80 mb-2">{error}</p>
            <p className="text-slate-400">
              Run <code className="bg-slate-950 px-1.5 py-0.5 rounded text-amber-300">npm run dev</code> inside the <code className="text-white">server</code> directory to launch Express on port 5000.
            </p>
          </div>
        </div>
      )}

      {health && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center gap-3">
            <Server className="w-4 h-4 text-emerald-400" />
            <div>
              <div className="text-[11px] text-slate-400">Server Status</div>
              <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> {health.status || 'Active'}
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center gap-3">
            <Database className="w-4 h-4 text-cyan-400" />
            <div>
              <div className="text-[11px] text-slate-400">Database</div>
              <div className="text-xs font-semibold text-slate-200 capitalize">
                {health.database || 'Connecting'}
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center gap-3">
            <Key className="w-4 h-4 text-amber-400" />
            <div>
              <div className="text-[11px] text-slate-400">Gemini AI Key</div>
              <div className="text-xs font-semibold text-slate-200">
                {health.geminiConfigured ? (
                  <span className="text-emerald-400">Configured</span>
                ) : (
                  <span className="text-amber-400">Pending .env</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
