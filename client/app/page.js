'use client';

import React, { useState } from 'react';
import HealthStatus from '../components/HealthStatus';
import AnalysisHistory from '../components/AnalysisHistory';
import ResultsDashboard from '../components/ResultsDashboard';
import { getApiUrl } from '../lib/api';
import {
  ShieldCheck,
  Search,
  Sparkles,
  Layers,
  Database,
  Lock,
  ArrowRight,
  AlertCircle,
  RefreshCw,
  Building,
  MapPin,
  Link2,
  DollarSign,
  User,
  Mail,
  Phone,
  Globe,
  ChevronDown,
  ChevronUp,
  X,
  CheckCircle2,
  Zap,
  Check,
  Shield,
  FileText,
} from 'lucide-react';

const INITIAL_FORM = {
  jobTitle: '',
  companyName: '',
  location: '',
  requirements: '',
  jobDescription: '',
  // Extended fields
  jobUrl: '',
  salary: '',
  currency: 'USD',
  recruiterName: '',
  recruiterEmail: '',
  recruiterPhone: '',
  applicationUrl: '',
  applicationSource: '',
};

const PIPELINE_STEPS = [
  { id: 'company', label: 'Verifying company online presence', icon: Building },
  { id: 'ats', label: 'Checking official career portals', icon: Search },
  { id: 'recruiter', label: 'Checking communication channels', icon: User },
  { id: 'scam', label: 'Scanning for known fraud & scam patterns', icon: ShieldCheck },
  { id: 'ai', label: 'Analyzing content with Google Gemini AI', icon: Sparkles },
  { id: 'scoring', label: 'Finalizing safety score & verdict', icon: Zap },
];

const InputField = ({ label, name, value, onChange, type = 'text', placeholder, required, icon: Icon, hint }) => (
  <div className="w-full">
    <label htmlFor={name} className="block text-xs font-semibold text-slate-300 mb-1.5">
      {label}{required && <span className="text-rose-400 ml-1 font-bold">*</span>}
    </label>
    <div className="relative w-full">
      {Icon && (
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none flex-shrink-0">
          <Icon className="w-4 h-4" />
        </div>
      )}
      <input
        id={name}
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className={`w-full ${Icon ? 'pl-10' : 'px-3.5 sm:px-4'} pr-3.5 sm:pr-4 py-2.5 sm:py-3 rounded-xl bg-slate-950/80 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/80 focus:ring-2 focus:ring-cyan-500/20 transition-all`}
      />
    </div>
    {hint && <p className="text-[11px] text-slate-400 mt-1">{hint}</p>}
  </div>
);

export default function HomePage() {
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pipelineStep, setPipelineStep] = useState(-1);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [isViewingStoredRecord, setIsViewingStoredRecord] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // Simulate pipeline step progression for friendly UX feedback
  const simulatePipelineSteps = () => {
    const delays = [0, 1500, 3500, 6000, 9000, 13000];
    delays.forEach((delay, idx) => {
      setTimeout(() => setPipelineStep(idx), delay);
    });
  };

  const handleAnalyze = async (e) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setIsViewingStoredRecord(false);
    setPipelineStep(-1);

    if (!formData.jobTitle.trim()) {
      setError('Please provide the Job Title (e.g. Frontend Developer, Sales Manager).');
      return;
    }

    if (!formData.companyName.trim()) {
      setError('Please provide the Company Name (e.g. Google, KBA Systems).');
      return;
    }

    if (!formData.jobDescription.trim() || formData.jobDescription.trim().length < 30) {
      setError('Please paste the Job Description or message (minimum 30 characters).');
      return;
    }

    setLoading(true);
    simulatePipelineSteps();

    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/analysis/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(
          `API returned HTTP ${response.status} (${response.statusText}). If on Vercel, ensure GEMINI_API_KEY and MONGODB_URI are configured in Vercel Environment Variables.`
        );
      }

      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.message || `Request failed with status ${response.status}`);
      }

      setPipelineStep(PIPELINE_STEPS.length);
      setResult(json.data);
      setRefreshTrigger((prev) => prev + 1);

      // Smooth scroll to results
      setTimeout(() => {
        document.getElementById('analysis-results-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 200);
    } catch (err) {
      setError(err.message || 'Failed to complete job analysis. Please verify details and try again.');
      setPipelineStep(-1);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectHistoryItem = async (id) => {
    if (!id) return;
    setDetailLoading(true);
    setError(null);
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/analysis/${id}`);
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(`API returned HTTP ${response.status}`);
      }
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.message || 'Failed to load record.');
      setResult(json.data);
      setIsViewingStoredRecord(true);
      setTimeout(() => {
        document.getElementById('analysis-results-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      setError(err.message || 'Failed to retrieve stored record.');
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="space-y-8 sm:space-y-10 w-full overflow-hidden">
      {/* ── HERO SECTION ─────────────────────────────────────────────────── */}
      <section className="text-center space-y-3.5 sm:space-y-4 pt-2 sm:pt-4 pb-2 px-1">
        <div className="inline-flex items-center gap-2 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[11px] sm:text-xs font-semibold tracking-wide">
          <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
          <span>Instant Job Scam & Legitimacy Checker</span>
        </div>

        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-white max-w-3xl mx-auto leading-tight px-1">
          Is That Job Offer Real or a{' '}
          <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
            Scam?
          </span>
        </h1>

        <p className="text-slate-300 text-xs sm:text-sm md:text-base max-w-2xl mx-auto leading-relaxed px-2">
          Paste any job posting or recruiter message. Our smart system verifies the company, checks official career boards, scans for fraud patterns, and gives you a clear safety verdict.
        </p>

        {/* 3 Simple Value Badges */}
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3 pt-2 text-[11px] sm:text-xs">
          <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-slate-300">
            <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            100% Free & Private
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-slate-300">
            <Zap className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            Verifies in Seconds
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-slate-300">
            <Building className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
            Real Company Check
          </span>
        </div>
      </section>

      {/* ── SYSTEM STATUS (Compact & Unobtrusive) ────────────────────────── */}
      <section className="max-w-3xl mx-auto w-full">
        <HealthStatus />
      </section>

      {/* ── JOB ANALYSIS FORM CARD ───────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto w-full bg-slate-900/70 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 backdrop-blur-md shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 sm:mb-6 pb-4 border-b border-slate-800 gap-2">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-cyan-400 flex-shrink-0" />
              <span>Check a Job Posting</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Enter the job title, company name, and paste the job description or email message.
            </p>
          </div>
          <span className="inline-flex self-start sm:self-auto px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[11px] sm:text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            Smart Verification
          </span>
        </div>

        <form onSubmit={handleAnalyze} className="space-y-4">
          {/* Row 1: Job Title & Company Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
            <InputField
              label="Job Title"
              name="jobTitle"
              value={formData.jobTitle}
              onChange={handleChange}
              placeholder="e.g. Software Developer, Data Entry, Virtual Assistant"
              icon={Building}
              required
            />
            <InputField
              label="Company Name"
              name="companyName"
              value={formData.companyName}
              onChange={handleChange}
              placeholder="e.g. Google, KBA Systems, Amazon"
              icon={Building}
              required
            />
          </div>

          {/* Row 2: Location (Optional) */}
          <div>
            <InputField
              label="Location (Optional)"
              name="location"
              value={formData.location}
              onChange={handleChange}
              placeholder="e.g. Remote, New York, London, Ahmedabad"
              icon={MapPin}
            />
          </div>

          {/* Job Description / Message (Required) */}
          <div>
            <div className="flex flex-col xs:flex-row xs:items-center justify-between mb-1.5 gap-1">
              <label htmlFor="jobDescription" className="block text-xs font-semibold text-slate-300">
                Job Description or Message <span className="text-rose-400 font-bold">*</span>
              </label>
              <span className="text-[11px] text-slate-400">Paste text, email, or WhatsApp message</span>
            </div>
            <textarea
              id="jobDescription"
              rows={6}
              name="jobDescription"
              value={formData.jobDescription}
              onChange={handleChange}
              required
              placeholder="Paste the job description, interview invite, salary promises, or application message here..."
              className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-slate-950/80 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/80 focus:ring-2 focus:ring-cyan-500/20 transition-all leading-relaxed"
            />
          </div>

          {/* Optional Extra Details Toggle */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors text-left"
            >
              {showAdvanced ? <ChevronUp className="w-3.5 h-3.5 flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />}
              <span>{showAdvanced ? 'Hide' : '+ Add'} recruiter email, salary, or contact details (optional)</span>
            </button>
          </div>

          {showAdvanced && (
            <div className="space-y-3.5 sm:space-y-4 p-4 sm:p-5 rounded-2xl bg-slate-950/50 border border-slate-800/70">
              <p className="text-xs text-slate-400">
                Optional: Adding recruiter email or stated salary helps detect lookalike domains and unrealistic pay promises.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <InputField
                  label="Recruiter Name"
                  name="recruiterName"
                  value={formData.recruiterName}
                  onChange={handleChange}
                  placeholder="e.g. Sarah Jenkins"
                  icon={User}
                />
                <InputField
                  label="Recruiter Email"
                  name="recruiterEmail"
                  value={formData.recruiterEmail}
                  onChange={handleChange}
                  type="email"
                  placeholder="e.g. sarah@company.com or hr@gmail.com"
                  icon={Mail}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <InputField
                  label="Recruiter Phone / WhatsApp"
                  name="recruiterPhone"
                  value={formData.recruiterPhone}
                  onChange={handleChange}
                  type="tel"
                  placeholder="e.g. +1 555-0192"
                  icon={Phone}
                />
                <InputField
                  label="Application Link / Website"
                  name="applicationUrl"
                  value={formData.applicationUrl}
                  onChange={handleChange}
                  type="url"
                  placeholder="e.g. https://company.com/apply"
                  icon={Link2}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="sm:col-span-2">
                  <InputField
                    label="Offered Salary / Compensation"
                    name="salary"
                    value={formData.salary}
                    onChange={handleChange}
                    placeholder="e.g. $80,000/year or ₹12 LPA or $50/hr"
                    icon={DollarSign}
                  />
                </div>
                <div>
                  <label htmlFor="currency" className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Currency
                  </label>
                  <select
                    id="currency"
                    name="currency"
                    value={formData.currency}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 sm:py-3 rounded-xl bg-slate-950/80 border border-slate-800 text-sm text-white focus:outline-none focus:border-cyan-500/80 transition-all"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="INR">INR (₹)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="CAD">CAD ($)</option>
                    <option value="AUD">AUD ($)</option>
                  </select>
                </div>
              </div>

              <InputField
                label="Where did you receive this offer?"
                name="applicationSource"
                value={formData.applicationSource}
                onChange={handleChange}
                placeholder="e.g. LinkedIn, WhatsApp, Telegram, Email, Indeed"
                icon={Globe}
              />
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3.5 sm:p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="font-semibold">Verification Note</p>
                <p className="text-rose-200/90 mt-0.5 break-words">{error}</p>
              </div>
            </div>
          )}

          {/* Pipeline Progress while analyzing */}
          {loading && pipelineStep >= 0 && (
            <div className="p-3.5 sm:p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1">
                <span>Checking job authenticity...</span>
                <span className="text-cyan-400 animate-pulse text-[11px]">Running live checks</span>
              </div>
              {PIPELINE_STEPS.map((step, idx) => {
                const Icon = step.icon;
                const done = idx < pipelineStep;
                const active = idx === pipelineStep;
                return (
                  <div key={step.id} className="flex items-center gap-2.5">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                      done ? 'bg-emerald-500/20 text-emerald-400' :
                      active ? 'bg-cyan-500/20 text-cyan-400' :
                      'bg-slate-800/60 text-slate-600'
                    }`}>
                      {done ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                       active ? <RefreshCw className="w-3 h-3 animate-spin" /> :
                       <Icon className="w-3 h-3" />}
                    </div>
                    <span className={`text-xs ${done ? 'text-emerald-400 font-medium' : active ? 'text-cyan-400 font-semibold' : 'text-slate-500'} truncate`}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Submit Action */}
          <div className="pt-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-400 order-2 sm:order-1">
              <Lock className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span>Your search is confidential & private</span>
            </div>

            <button
              type="submit"
              id="analyze-submit-btn"
              disabled={loading || detailLoading}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer order-1 sm:order-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin flex-shrink-0" />
                  <span>Checking Safety...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                  <span>Check Job Safety Now</span>
                  <ArrowRight className="w-4 h-4 flex-shrink-0" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Loading saved record */}
        {detailLoading && (
          <div className="mt-8 py-8 text-center text-xs sm:text-sm text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-cyan-400 flex-shrink-0" />
            <span>Loading saved analysis...</span>
          </div>
        )}

        {/* Results Section */}
        {result && !detailLoading && (
          <div className="relative">
            {isViewingStoredRecord && (
              <div className="flex items-center justify-between mt-8 pt-4 border-t border-slate-800 gap-2">
                <span className="text-xs px-3 py-1 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-medium truncate">
                  Viewing Previous Analysis Record
                </span>
                <button
                  onClick={() => { setResult(null); setIsViewingStoredRecord(false); }}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors flex-shrink-0"
                  aria-label="Close detail view"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            <ResultsDashboard result={result} />
          </div>
        )}
      </section>

      {/* ── RECENT ANALYSES HISTORY ──────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto w-full">
        <AnalysisHistory onSelectAnalysis={handleSelectHistoryItem} refreshTrigger={refreshTrigger} />
      </section>

      {/* ── HOW IT WORKS / SIMPLE EXPLANATION ────────────────────────────── */}
      <section className="max-w-4xl mx-auto w-full pt-4">
        <div className="text-center mb-6 px-2">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">How We Check Each Job</h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">Multi-layered security checks designed to protect job seekers</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5">
          {[
            { icon: Building, color: 'cyan', title: '1. Company Verification', desc: 'Checks live domain, official website, and company registry online.' },
            { icon: Search, color: 'emerald', title: '2. Job Board Match', desc: 'Looks for official listings on company career portals (Greenhouse, Lever).' },
            { icon: ShieldCheck, color: 'rose', title: '3. Scam Pattern Scan', desc: 'Detects advance-fee traps, gift-card demands, and suspicious keywords.' },
            { icon: Sparkles, color: 'violet', title: '4. AI Safety Analysis', desc: 'Google Gemini AI evaluates full text and provides clear safety advice.' },
          ].map((item) => (
            <div key={item.title} className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/70 hover:border-slate-700 transition-all flex flex-col justify-between">
              <div>
                <div className={`w-8 h-8 rounded-lg bg-${item.color}-500/10 border border-${item.color}-500/20 text-${item.color}-400 flex items-center justify-center mb-3 flex-shrink-0`}>
                  <item.icon className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-white text-xs">{item.title}</h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
