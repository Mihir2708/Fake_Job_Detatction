'use client';

import React, { useState } from 'react';
import HealthStatus from '../components/HealthStatus';
import AnalysisHistory from '../components/AnalysisHistory';
import {
  ShieldAlert,
  Search,
  Sparkles,
  Layers,
  Database,
  Lock,
  ArrowRight,
  AlertCircle,
  CheckCircle,
  FileText,
  AlertTriangle,
  Info,
  RefreshCw,
  Building,
  MapPin,
  Calendar,
  X,
} from 'lucide-react';

export default function HomePage() {
  const [formData, setFormData] = useState({
    jobTitle: '',
    companyName: '',
    location: '',
    requirements: '',
    jobDescription: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [isViewingStoredRecord, setIsViewingStoredRecord] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleAnalyze = async (e) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setIsViewingStoredRecord(false);

    if (!formData.jobDescription.trim() || formData.jobDescription.trim().length < 30) {
      setError('Please provide a meaningful job description (minimum 30 characters) for analysis.');
      return;
    }

    setLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${apiUrl}/analysis/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.message || `Request failed with status ${response.status}`);
      }

      setResult(json.data);
      // Automatically refresh history to include the newly saved record
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      setError(err.message || 'Failed to complete job analysis.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch full stored record details from GET /api/analysis/:id without calling Gemini
  const handleSelectHistoryItem = async (id) => {
    if (!id) return;
    setDetailLoading(true);
    setError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${apiUrl}/analysis/${id}`);
      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.message || 'Failed to load analysis record.');
      }

      setResult(json.data);
      setIsViewingStoredRecord(true);

      // Scroll smoothly to the result view
      const resultsElement = document.getElementById('analysis-results-section');
      if (resultsElement) {
        resultsElement.scrollIntoView({ behavior: 'smooth' });
      }
    } catch (err) {
      setError(err.message || 'Failed to retrieve stored record.');
    } finally {
      setDetailLoading(false);
    }
  };

  const getPredictionBadge = (prediction) => {
    switch (prediction) {
      case 'LIKELY_REAL':
        return {
          bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
          icon: <CheckCircle className="w-4 h-4" />,
          label: 'Likely Legitimate Opportunity',
        };
      case 'SUSPICIOUS':
        return {
          bg: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
          icon: <AlertTriangle className="w-4 h-4" />,
          label: 'Suspicious / Potential Scam',
        };
      case 'INSUFFICIENT_INFORMATION':
      default:
        return {
          bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
          icon: <Info className="w-4 h-4" />,
          label: 'Insufficient Information',
        };
    }
  };

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="text-center space-y-5 pt-4 pb-2">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium tracking-wide">
          <ShieldAlert className="w-4 h-4" />
          <span>Phase 3: MongoDB Persistence &amp; Analysis History</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-tight">
          Detect Fake Job Postings with{' '}
          <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
            Google Gemini AI
          </span>
        </h1>

        <p className="text-slate-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
          AI employment fraud detection backed by MongoDB persistence. Evaluate job listings, store findings, and review analysis history.
        </p>
      </section>

      {/* Backend Health Check Widget */}
      <section className="max-w-4xl mx-auto">
        <HealthStatus />
      </section>

      {/* Job Scam Analysis Form */}
      <section className="max-w-4xl mx-auto bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-md shadow-2xl">
        <div className="flex items-center justify-between mb-6 pb-6 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-white">Evaluate Job Posting</h2>
            <p className="text-xs text-slate-400 mt-1">
              POST /api/analysis/analyze — Submit job details to trigger Gemini AI scoring and persist results in MongoDB.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            Phase 3 Active
          </span>
        </div>

        <form onSubmit={handleAnalyze} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Job Title (Optional)</label>
              <input
                type="text"
                name="jobTitle"
                value={formData.jobTitle}
                onChange={handleChange}
                placeholder="e.g. Remote Data Entry Clerk"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Company Name (Optional)</label>
              <input
                type="text"
                name="companyName"
                value={formData.companyName}
                onChange={handleChange}
                placeholder="e.g. Global Tech Innovations"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Location / Remote (Optional)</label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="e.g. Remote (Work From Home) or San Francisco, CA"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Requirements / Skills (Optional)</label>
              <input
                type="text"
                name="requirements"
                value={formData.requirements}
                onChange={handleChange}
                placeholder="e.g. No experience needed, Telegram access, or 5+ yrs Node.js"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Job Description <span className="text-rose-400">*</span> (Required, min 30 chars)
            </label>
            <textarea
              rows={5}
              name="jobDescription"
              required
              value={formData.jobDescription}
              onChange={handleChange}
              placeholder="Paste full job description, application instructions, contact details, and interview process text here..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Request Error</p>
                <p className="text-rose-200/80">{error}</p>
              </div>
            </div>
          )}

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Prompt treated as untrusted data to guard against prompt injection</span>
            </div>

            <button
              type="submit"
              disabled={loading || detailLoading}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Evaluating with Gemini...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Analyze Risk &amp; Save</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Structured Results Display */}
        {detailLoading && (
          <div className="mt-8 py-8 text-center text-sm text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
            <span>Loading stored analysis record...</span>
          </div>
        )}

        {result && !detailLoading && (
          <div id="analysis-results-section" className="mt-8 pt-8 border-t border-slate-800 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
                    getPredictionBadge(result.prediction).bg
                  }`}
                >
                  {getPredictionBadge(result.prediction).icon}
                  <span>{getPredictionBadge(result.prediction).label}</span>
                </span>

                <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
                  Risk Level: <strong className="text-white">{result.riskLevel}</strong>
                </span>

                {isViewingStoredRecord && (
                  <span className="text-[11px] px-2 py-0.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    Stored Database Record
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-400">
                {(result.id || result._id) && (
                  <span className="font-mono text-[11px] text-slate-500">
                    ID: {(result.id || result._id).slice(-8)}
                  </span>
                )}
                {isViewingStoredRecord && (
                  <button
                    onClick={() => {
                      setResult(null);
                      setIsViewingStoredRecord(false);
                    }}
                    className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                    title="Close detail view"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Posting Summary Banner */}
            {(result.jobTitle || result.companyName || result.location) && (
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-wrap items-center gap-4 text-xs text-slate-300">
                {result.jobTitle && <span className="font-semibold text-white">{result.jobTitle}</span>}
                {result.companyName && (
                  <span className="flex items-center gap-1 text-slate-400">
                    <Building className="w-3.5 h-3.5 text-slate-500" />
                    {result.companyName}
                  </span>
                )}
                {result.location && (
                  <span className="flex items-center gap-1 text-slate-400">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    {result.location}
                  </span>
                )}
                {result.createdAt && (
                  <span className="flex items-center gap-1 text-slate-500 ml-auto text-[11px]">
                    <Calendar className="w-3 h-3" />
                    {new Date(result.createdAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                )}
              </div>
            )}

            {/* Reasons List */}
            {result.reasons && result.reasons.length > 0 && (
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-2">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Observed Risk Factors &amp; Textual Evidence
                </h4>
                <ul className="space-y-1.5 text-xs text-slate-400">
                  {result.reasons.map((reason, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold">&bull;</span>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendation */}
            {result.recommendation && (
              <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-1">
                <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                  Verification Recommendation
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">{result.recommendation}</p>
              </div>
            )}

            {/* Limitations Notice */}
            {result.limitations && (
              <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/60 text-[11px] text-slate-400 flex items-start gap-2">
                <Info className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                <p>{result.limitations}</p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Analysis History Section */}
      <section className="max-w-4xl mx-auto">
        <AnalysisHistory
          onSelectAnalysis={handleSelectHistoryItem}
          refreshTrigger={refreshTrigger}
        />
      </section>

      {/* Architecture Highlights */}
      <section className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white tracking-tight">System Architecture Foundation</h2>
          <p className="text-sm text-slate-400 mt-1">
            Modular full-stack setup with clean separation of concerns and secure API handling
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800/80 hover:border-slate-700 transition-all">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mb-4">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-white text-sm">Next.js App Router</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              JavaScript-only frontend with Tailwind CSS, modular components, and dark theme UI.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800/80 hover:border-slate-700 transition-all">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-white text-sm">Express.js Server</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Modular REST API with controllers, routes, middleware, and centralized error handling.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800/80 hover:border-slate-700 transition-all">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
              <Database className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-white text-sm">MongoDB &amp; Mongoose</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Persistent storage for job analysis reports, risk findings, and paginated history retrieval.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/50 border border-slate-800/80 hover:border-slate-700 transition-all">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-4">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-white text-sm">Google Gemini AI</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Official Google Gen AI SDK backend integration. API keys remain strictly secure on the server.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
