'use client';

import React, { useState, useEffect } from 'react';
import {
  History,
  RefreshCw,
  AlertCircle,
  Clock,
  Building,
  MapPin,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  Info,
  CheckCircle,
} from 'lucide-react';

export default function AnalysisHistory({ onSelectAnalysis, refreshTrigger }) {
  const [history, setHistory] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${apiUrl}/analysis/history?page=1&limit=10`);
      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.message || 'Failed to retrieve analysis history.');
      }

      setHistory(json.data || []);
      setPagination(json.pagination || null);
    } catch (err) {
      setError(err.message || 'Unable to connect to database history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [refreshTrigger]);

  const handleSelect = (id) => {
    setSelectedId(id);
    if (onSelectAnalysis) {
      onSelectAnalysis(id);
    }
  };

  const getPredictionBadge = (prediction) => {
    switch (prediction) {
      case 'LIKELY_REAL':
        return {
          bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
          icon: <CheckCircle className="w-3.5 h-3.5" />,
          label: 'Likely Real',
        };
      case 'SUSPICIOUS':
        return {
          bg: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
          icon: <AlertTriangle className="w-3.5 h-3.5" />,
          label: 'Suspicious',
        };
      case 'INSUFFICIENT_INFORMATION':
      default:
        return {
          bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
          icon: <Info className="w-3.5 h-3.5" />,
          label: 'Inconclusive',
        };
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Recent';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Recent';
    }
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-md shadow-2xl space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-lg">Analysis History</h3>
            <p className="text-xs text-slate-400">
              MongoDB Stored Records {pagination ? `(${pagination.totalRecords} total)` : ''}
            </p>
          </div>
        </div>

        <button
          onClick={fetchHistory}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors disabled:opacity-50 border border-slate-700"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="py-12 text-center text-sm text-slate-400 space-y-3">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-cyan-400" />
          <p>Loading stored analysis records from MongoDB...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Unable to Load History</p>
              <p className="text-amber-200/80 mt-0.5">{error}</p>
            </div>
          </div>
          <button
            onClick={fetchHistory}
            className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && history.length === 0 && (
        <div className="py-12 text-center text-slate-400 space-y-3 border border-dashed border-slate-800 rounded-2xl p-6">
          <ShieldCheck className="w-10 h-10 mx-auto text-slate-600" />
          <p className="text-sm font-medium text-slate-300">No analyses recorded yet</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Submit a job posting above to generate your first AI scam evaluation and persist it in MongoDB.
          </p>
        </div>
      )}

      {/* History List */}
      {!loading && !error && history.length > 0 && (
        <div className="space-y-3">
          {history.map((item) => {
            const badge = getPredictionBadge(item.prediction);
            const isSelected = selectedId === (item._id || item.id);

            return (
              <div
                key={item._id || item.id}
                onClick={() => handleSelect(item._id || item.id)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isSelected
                    ? 'bg-slate-800/80 border-cyan-500/50 shadow-md shadow-cyan-500/10'
                    : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/60'
                }`}
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-sm text-white truncate">
                      {item.jobTitle || item.companyName || 'Untitled Job Analysis'}
                    </h4>
                    {item.companyName && item.jobTitle && (
                      <span className="text-xs text-slate-400 flex items-center gap-1 truncate">
                        <Building className="w-3 h-3 text-slate-500 flex-shrink-0" />
                        {item.companyName}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                    {item.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-500" />
                        {item.location}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-slate-500">
                      <Clock className="w-3 h-3" />
                      {formatDate(item.createdAt)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium ${badge.bg}`}
                  >
                    {badge.icon}
                    <span>{badge.label}</span>
                  </span>

                  <span className="text-[11px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 font-medium">
                    Risk: <span className="text-white">{item.riskLevel}</span>
                  </span>

                  <div className="text-slate-500 hover:text-cyan-400 transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
