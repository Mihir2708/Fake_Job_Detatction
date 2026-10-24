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

  const getPredictionBadge = (item) => {
    const hasScore = typeof item?.riskScore === 'number';
    if (hasScore) {
      if (item.riskScore <= 29) {
        return {
          bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
          icon: <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />,
          label: 'Safe',
          riskColor: 'text-emerald-400',
          riskText: 'Low',
        };
      }
      if (item.riskScore <= 59) {
        return {
          bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
          icon: <Info className="w-3.5 h-3.5 flex-shrink-0" />,
          label: 'Caution',
          riskColor: 'text-amber-400',
          riskText: 'Moderate',
        };
      }
      return {
        bg: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
        icon: <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />,
        label: 'High Risk',
        riskColor: 'text-rose-400',
        riskText: 'High',
      };
    }

    const prediction = item?.prediction;
    const verdict = item?.verdict;
    const riskLevel = item?.riskLevel;

    if (verdict === 'LOWER_RISK' || prediction === 'LIKELY_REAL' || riskLevel === 'LOW') {
      return {
        bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
        icon: <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />,
        label: 'Safe',
        riskColor: 'text-emerald-400',
        riskText: 'Low',
      };
    }

    if (verdict === 'HIGH_RISK' || prediction === 'SUSPICIOUS' || riskLevel === 'HIGH') {
      return {
        bg: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
        icon: <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />,
        label: 'High Risk',
        riskColor: 'text-rose-400',
        riskText: 'High',
      };
    }

    return {
      bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
      icon: <Info className="w-3.5 h-3.5 flex-shrink-0" />,
      label: 'Caution',
      riskColor: 'text-amber-400',
      riskText: 'Moderate',
    };
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
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 backdrop-blur-md shadow-2xl space-y-5 sm:space-y-6 w-full">
      <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between pb-4 border-b border-slate-800 gap-3">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex-shrink-0">
            <History className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-white text-base sm:text-lg truncate">Recent Checked Jobs</h3>
            <p className="text-[11px] sm:text-xs text-slate-400 truncate">
              Previously analyzed job postings {pagination ? `(${pagination.totalRecords} total)` : ''}
            </p>
          </div>
        </div>

        <button
          onClick={fetchHistory}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors disabled:opacity-50 border border-slate-700 flex-shrink-0 self-end xs:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="py-10 text-center text-xs sm:text-sm text-slate-400 space-y-2.5">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto text-cyan-400" />
          <p>Loading previous job checks...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="p-3.5 sm:p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-semibold">Unable to Load History</p>
              <p className="text-amber-200/80 mt-0.5 break-words">{error}</p>
            </div>
          </div>
          <button
            onClick={fetchHistory}
            className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-medium transition-colors flex-shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && history.length === 0 && (
        <div className="py-10 sm:py-12 text-center text-slate-400 space-y-2.5 border border-dashed border-slate-800 rounded-2xl p-4 sm:p-6">
          <ShieldCheck className="w-9 h-9 sm:w-10 sm:h-10 mx-auto text-slate-600" />
          <p className="text-sm font-medium text-slate-300">No previous checks yet</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
            Submit a job posting above to verify its authenticity and see it saved here for future reference.
          </p>
        </div>
      )}

      {/* History List */}
      {!loading && !error && history.length > 0 && (
        <div className="space-y-2.5 sm:space-y-3">
          {history.map((item) => {
            const badge = getPredictionBadge(item);
            const isSelected = selectedId === (item._id || item.id);

            return (
              <div
                key={item._id || item.id}
                onClick={() => handleSelect(item._id || item.id)}
                className={`p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                  isSelected
                    ? 'bg-slate-800/80 border-cyan-500/50 shadow-md shadow-cyan-500/10'
                    : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/60'
                }`}
              >
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <h4 className="font-semibold text-sm text-white truncate max-w-full">
                      {item.jobTitle || item.companyName || 'Untitled Job Analysis'}
                    </h4>
                    {item.companyName && item.jobTitle && (
                      <span className="text-xs text-slate-400 inline-flex items-center gap-1 truncate max-w-[200px]">
                        <Building className="w-3 h-3 text-slate-500 flex-shrink-0" />
                        <span className="truncate">{item.companyName}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-slate-400">
                    {item.location && (
                      <span className="flex items-center gap-1 truncate max-w-[150px]">
                        <MapPin className="w-3 h-3 text-slate-500 flex-shrink-0" />
                        <span className="truncate">{item.location}</span>
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-slate-500">
                      <Clock className="w-3 h-3 flex-shrink-0" />
                      {formatDate(item.createdAt)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-2.5 flex-wrap pt-1 md:pt-0 border-t border-slate-800/50 md:border-0">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 sm:py-1 rounded-lg border text-[11px] sm:text-xs font-medium ${badge.bg}`}
                  >
                    {badge.icon}
                    <span>{badge.label}</span>
                  </span>

                  <span className="text-[11px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 font-medium">
                    Risk: <span className={`font-semibold ${badge.riskColor}`}>{badge.riskText}</span>
                  </span>

                  <div className="text-slate-500 hover:text-cyan-400 transition-colors ml-auto md:ml-0">
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
