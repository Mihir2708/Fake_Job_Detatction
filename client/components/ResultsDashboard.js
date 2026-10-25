'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  ShieldAlert,
  Shield,
  Globe,
  Briefcase,
  User,
  AlertOctagon,
  DollarSign,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  Clock,
  HelpCircle,
  Check,
  ArrowRight,
  Info,
  Building2,
  Lock,
} from 'lucide-react';

// ── Status Badges ─────────────────────────────────────────────────────────────

const STATUS_CONFIGS = {
  VERIFIED: { color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2, label: 'Verified Safe' },
  VERIFIED_MATCH: { color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2, label: 'Verified Match' },
  SUSPICIOUS: { color: 'text-rose-400 bg-rose-500/10 border-rose-500/20', icon: AlertTriangle, label: 'Suspicious' },
  NOT_FOUND: { color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', icon: Info, label: 'Not Found' },
  POSSIBLE_MATCH: { color: 'text-sky-400 bg-sky-500/10 border-sky-500/20', icon: Info, label: 'Possible Match' },
  SOURCE_UNAVAILABLE: { color: 'text-slate-400 bg-slate-700/30 border-slate-600/30', icon: Clock, label: 'Unavailable' },
  NOT_CHECKED: { color: 'text-slate-500 bg-slate-800/40 border-slate-700/30', icon: HelpCircle, label: 'Not Checked' },
  OK: { color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2, label: 'OK' },
  HTTP_ERROR: { color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', icon: Info, label: 'Error' },
  TIMEOUT: { color: 'text-slate-400 bg-slate-700/30 border-slate-600/30', icon: Clock, label: 'Timeout' },
  BLOCKED_SSRF: { color: 'text-rose-400 bg-rose-500/10 border-rose-500/20', icon: XCircle, label: 'Blocked' },
  INVALID_URL: { color: 'text-rose-400 bg-rose-500/10 border-rose-500/20', icon: XCircle, label: 'Invalid URL' },
};

const StatusBadge = ({ status, size = 'sm' }) => {
  const cfg = STATUS_CONFIGS[status] || STATUS_CONFIGS['NOT_CHECKED'];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-0.5 rounded-full border text-[11px] sm:text-${size === 'sm' ? 'xs' : 'sm'} font-medium ${cfg.color} flex-shrink-0`}>
      <Icon className="w-3 h-3 flex-shrink-0" />
      <span className="truncate">{cfg.label}</span>
    </span>
  );
};

// ── Evidence Item ─────────────────────────────────────────────────────────────

const EvidenceItem = ({ label, value, status, sourceUrl, explanation }) => (
  <div className="py-2.5 border-b border-slate-800/60 last:border-0 w-full">
    <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1">
      <span className="text-xs text-slate-400 font-medium">{label}</span>
      {status && <StatusBadge status={status} />}
    </div>
    {explanation && <p className="text-xs text-slate-300 leading-relaxed break-words">{explanation}</p>}
    {value && !explanation && <p className="text-xs text-slate-300 font-mono break-all">{value}</p>}
    {sourceUrl && (
      <a
        href={sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1.5 inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors break-all"
      >
        <ExternalLink className="w-3 h-3 flex-shrink-0" />
        <span className="truncate">View verified source</span>
      </a>
    )}
  </div>
);

// ── Technical Section Accordion ───────────────────────────────────────────────

const SectionCard = ({ icon: Icon, title, status, children, defaultOpen = false, accentColor = 'emerald' }) => {
  const [open, setOpen] = useState(defaultOpen);

  const accentMap = {
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    rose: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    sky: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
    violet: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
    slate: 'text-slate-400 bg-slate-700/30 border-slate-600/30',
  };

  return (
    <div className="rounded-xl bg-slate-950/60 border border-slate-800/80 overflow-hidden w-full">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3 sm:p-3.5 hover:bg-slate-800/30 transition-colors gap-2"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center border ${accentMap[accentColor]} flex-shrink-0`}>
            <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <div className="text-left min-w-0">
            <div className="text-xs sm:text-sm font-semibold text-white truncate">{title}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          <StatusBadge status={status} />
          {open ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </div>
      </button>

      {open && (
        <div className="px-3.5 sm:px-4 pb-3.5 sm:pb-4 pt-1 border-t border-slate-800/60 w-full overflow-hidden">
          {children}
        </div>
      )}
    </div>
  );
};

// ── Main User-Friendly Results Dashboard ──────────────────────────────────────

export default function ResultsDashboard({ result }) {
  const [showTechnical, setShowTechnical] = useState(false);
  const [showScoreMath, setShowScoreMath] = useState(false);

  if (!result) return null;

  const { verificationChecks: vc, scoringBreakdown } = result;
  const hasScore = typeof result.riskScore === 'number';
  const score = hasScore ? Math.min(100, Math.max(0, result.riskScore)) : (
    result.verdict === 'HIGH_RISK' ? 80 : result.verdict === 'CAUTION' ? 45 : 10
  );

  // Determine user-friendly verdict tier strictly by score & risk indicator:
  // 0  - 29: Low Risk / Safe (GREEN)
  // 30 - 59: Moderate Risk / Caution (YELLOW / AMBER)
  // 60 - 100: High Risk / Scam (RED)
  let isSafe = false;
  let isCaution = false;
  let isHighRisk = false;

  if (hasScore) {
    if (score <= 29) {
      isSafe = true;
    } else if (score <= 59) {
      isCaution = true;
    } else {
      isHighRisk = true;
    }
  } else if (result.verdict === 'LOWER_RISK') {
    isSafe = true;
  } else if (result.verdict === 'CAUTION') {
    isCaution = true;
  } else if (result.verdict === 'HIGH_RISK') {
    isHighRisk = true;
  } else {
    isSafe = result.riskLevel === 'LOW' || result.prediction === 'LIKELY_REAL';
    isHighRisk = result.riskLevel === 'HIGH' || result.prediction === 'SUSPICIOUS';
    isCaution = !isSafe && !isHighRisk;
  }

  // Verdict style & text
  const verdictConfig = isSafe
    ? {
      theme: 'emerald',
      bg: 'from-emerald-950/40 to-slate-900/90 border-emerald-500/30 shadow-emerald-950/20',
      badgeBg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
      icon: ShieldCheck,
      badgeLabel: 'VERIFIED SAFE',
      title: 'Looks Safe to Apply',
      subtitle: 'Our multi-layer verification found an authentic company presence with no known scam patterns.',
    }
    : isHighRisk
      ? {
        theme: 'rose',
        bg: 'from-rose-950/40 to-slate-900/90 border-rose-500/30 shadow-rose-950/20',
        badgeBg: 'bg-rose-500/15 border-rose-500/30 text-rose-400',
        icon: ShieldAlert,
        badgeLabel: 'DANGER / SCAM',
        title: 'High Risk Scam Alert',
        subtitle: 'Warning: Serious fraudulent indicators or advance-fee patterns were detected in this posting.',
      }
      : {
        theme: 'amber',
        bg: 'from-amber-950/40 to-slate-900/90 border-amber-500/30 shadow-amber-950/20',
        badgeBg: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
        icon: AlertTriangle,
        badgeLabel: 'NEEDS CAUTION',
        title: 'Proceed with Caution',
        subtitle: 'Some company or recruiter details could not be independently verified.',
      };

  const VerdictIcon = verdictConfig.icon;

  // Simple checklist cards data
  const companyStatus = vc?.company?.overallStatus;
  const isCompanyVerified = companyStatus === 'VERIFIED' || companyStatus === 'VERIFIED_MATCH' || companyStatus === 'OK';
  const companyDomain = vc?.company?.identifiedOfficialDomain;

  const atsStatus = vc?.careers?.overallStatus;
  const isAtsFound = atsStatus === 'VERIFIED_MATCH' || atsStatus === 'VERIFIED';

  const scamStatus = vc?.scam?.overallStatus;
  const hasScamPatterns = scamStatus === 'SUSPICIOUS' || isHighRisk;

  const recruiterStatus = vc?.recruiter?.overallStatus;
  const isRecruiterSuspicious = recruiterStatus === 'SUSPICIOUS';

  return (
    <div className="space-y-5 sm:space-y-6 mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-slate-800 w-full" id="analysis-results-section">

      {/* ── 1. HERO VERDICT CARD ─────────────────────────────────────────── */}
      <div className={`p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl bg-gradient-to-b ${verdictConfig.bg} border shadow-2xl backdrop-blur-md w-full`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6 pb-5 sm:pb-6 border-b border-slate-800/80">
          <div className="flex items-start sm:items-center gap-3.5 sm:gap-4 min-w-0">
            <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0 ${verdictConfig.badgeBg} border`}>
              <VerdictIcon className="w-7 h-7 sm:w-9 sm:h-9" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
                <span className={`px-2 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold border tracking-wide uppercase ${verdictConfig.badgeBg}`}>
                  {verdictConfig.badgeLabel}
                </span>
                <span className="text-[11px] text-slate-400">Analysis Complete</span>
              </div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight break-words">
                {verdictConfig.title}
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl leading-relaxed">
                {verdictConfig.subtitle}
              </p>
            </div>
          </div>

          {/* Quick Score Pill */}
          <div className="w-full sm:w-auto flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start bg-slate-950/70 border border-slate-800/80 px-4 py-3 sm:px-5 sm:py-3.5 rounded-xl sm:rounded-2xl flex-shrink-0">
            <div className="text-left sm:text-right">
              <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Scam Risk</span>
              <span className={`text-[10px] font-semibold capitalize ${isSafe ? 'text-emerald-400' : isHighRisk ? 'text-rose-400' : 'text-amber-400'
                }`}>
                {isSafe ? 'Low Risk (Safe)' : isHighRisk ? 'High Risk (Danger)' : 'Moderate (Caution)'}
              </span>
            </div>
            <div className="flex items-baseline gap-1 mt-0 sm:mt-0.5">
              <span className={`text-2xl sm:text-3xl font-black ${isSafe ? 'text-emerald-400' : isHighRisk ? 'text-rose-400' : 'text-amber-400'
                }`}>
                {score}
              </span>
              <span className="text-xs font-semibold text-slate-400">/ 100 Risk</span>
            </div>
          </div>
        </div>

        {/* ── 2. VISUAL SAFETY METER ─────────────────────────────────────── */}
        <div className="mt-5 sm:mt-6 pt-1">
          <div className="flex flex-col xs:flex-row xs:items-center justify-between text-xs font-semibold mb-2 gap-1">
            <span className="text-slate-300 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
              <span>Safety & Risk Spectrum</span>
            </span>
            <span className={`font-bold ${isSafe ? 'text-emerald-400' : isHighRisk ? 'text-rose-400' : 'text-amber-400'}`}>
              Your Job: {isSafe ? 'Safe / Low Risk' : isHighRisk ? 'High Risk (Scam)' : 'Moderate Risk (Caution)'} ({score}/100)
            </span>
          </div>

          {/* Segmented bar */}
          <div className="relative w-full h-3 sm:h-3.5 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
            <div className="w-full h-full rounded-full flex">
              <div className="w-[30%] bg-emerald-500/80" title="Safe Zone (0 - 29)" />
              <div className="w-[30%] bg-amber-500/80" title="Caution Zone (30 - 59)" />
              <div className="w-[40%] bg-rose-500/80" title="High Risk Zone (60 - 100)" />
            </div>

            {/* Needle indicator */}
            <div
              className={`absolute top-0 bottom-0 w-2.5 sm:w-3 rounded-full border-2 border-slate-950 -translate-x-1 sm:-translate-x-1.5 transition-all duration-700 shadow-md ${isSafe
                ? 'bg-emerald-400 shadow-emerald-400/80'
                : isHighRisk
                  ? 'bg-rose-500 shadow-rose-500/80'
                  : 'bg-amber-400 shadow-amber-400/80'
                }`}
              style={{ left: `${score}%` }}
            />
          </div>

          {/* Labels */}
          <div className="grid grid-cols-3 text-[10px] sm:text-[11px] font-medium text-slate-400 mt-1.5 px-0.5">
            <span className="text-left text-emerald-400/90 font-semibold truncate">🟢 Safe (0-29)</span>
            <span className="text-center text-amber-400/90 font-semibold truncate">🟡 Caution (30-59)</span>
            <span className="text-right text-rose-400/90 font-semibold truncate">🔴 Danger (60-100)</span>
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-400 mt-2 italic leading-relaxed">
            💡 <strong>How to read:</strong> Lower is safer! 0 means completely clean with zero suspicious flags detected.
          </p>
        </div>
      </div>

      {/* ── 3. SIMPLE 4-POINT SAFETY CHECKLIST ───────────────────────────── */}
      <div>
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-cyan-400 flex-shrink-0" />
          <span>4-Point Safety Quick-Check</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5">
          {/* Card 1: Company Existence */}
          <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2 gap-1">
                <span className="text-xs font-semibold text-slate-400 truncate">1. Company Legitimacy</span>
                {isCompanyVerified ? (
                  <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex-shrink-0">
                    <Check className="w-3 h-3" /> Real
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 flex-shrink-0">
                    <Info className="w-3 h-3" /> Unverified
                  </span>
                )}
              </div>
              <h4 className="text-sm font-bold text-white mb-1">Authentic Business</h4>
              <p className="text-xs text-slate-400 leading-relaxed break-words">
                {companyDomain
                  ? `Active official domain (${companyDomain}) verified online.`
                  : isCompanyVerified
                    ? 'Genuine online footprint confirmed.'
                    : 'Company has minimal or no verifiable official domain records.'}
              </p>
            </div>
            {companyDomain && (
              <a
                href={vc?.company?.identifiedOfficialUrl || `https://${companyDomain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 font-medium transition-colors truncate"
              >
                <span className="truncate">Visit website</span>
                <ExternalLink className="w-3 h-3 flex-shrink-0" />
              </a>
            )}
          </div>

          {/* Card 2: Job Listing Status */}
          <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2 gap-1">
                <span className="text-xs font-semibold text-slate-400 truncate">2. Career Portal Match</span>
                {isAtsFound ? (
                  <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex-shrink-0">
                    <Check className="w-3 h-3" /> Listed
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-medium text-slate-400 bg-slate-800/50 px-2 py-0.5 rounded-full border border-slate-700/40 flex-shrink-0">
                    Direct / Board
                  </span>
                )}
              </div>
              <h4 className="text-sm font-bold text-white mb-1">Public Job Opening</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                {isAtsFound
                  ? 'Matched directly on an official corporate career board (Greenhouse/Lever).'
                  : 'Direct or external job posting. Not found on major ATS boards.'}
              </p>
            </div>
          </div>

          {/* Card 3: No Fee / Advance-Payment Demands */}
          <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2 gap-1">
                <span className="text-xs font-semibold text-slate-400 truncate">3. Fee & Payment</span>
                {!hasScamPatterns ? (
                  <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex-shrink-0">
                    <Check className="w-3 h-3" /> No Fees
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20 flex-shrink-0">
                    <AlertTriangle className="w-3 h-3" /> Red Flag
                  </span>
                )}
              </div>
              <h4 className="text-sm font-bold text-white mb-1">No Money Demanded</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                {!hasScamPatterns
                  ? 'No suspicious requests for registration fees, training charges, or gift cards.'
                  : 'Suspicious requests for money, deposits, or gift cards were flagged!'}
              </p>
            </div>
          </div>

          {/* Card 4: Recruiter & Contact Channel */}
          <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2 gap-1">
                <span className="text-xs font-semibold text-slate-400 truncate">4. Contact Channel</span>
                {!isRecruiterSuspicious ? (
                  <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex-shrink-0">
                    <Check className="w-3 h-3" /> Normal
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20 flex-shrink-0">
                    <AlertTriangle className="w-3 h-3" /> Suspicious
                  </span>
                )}
              </div>
              <h4 className="text-sm font-bold text-white mb-1">Safe Communication</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                {!isRecruiterSuspicious
                  ? 'Standard hiring communication channels and domains.'
                  : 'Free personal email (Gmail/Yahoo) or unverified chat application flagged.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. WHAT SHOULD YOU DO NEXT? ─────────────────────────────────── */}
      <div className={`p-4 sm:p-6 rounded-2xl border ${isSafe
        ? 'bg-emerald-500/5 border-emerald-500/20'
        : isHighRisk
          ? 'bg-rose-500/10 border-rose-500/30'
          : 'bg-amber-500/5 border-amber-500/20'
        }`}>
        <h4 className={`text-sm font-bold mb-3 flex items-center gap-2 ${isSafe ? 'text-emerald-400' : isHighRisk ? 'text-rose-400' : 'text-amber-400'
          }`}>
          <ArrowRight className="w-4 h-4 flex-shrink-0" />
          <span>Recommended Next Steps for You</span>
        </h4>

        <div className="space-y-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
          {result.recommendation ? (
            <p className="leading-relaxed mb-3 break-words">{result.recommendation}</p>
          ) : null}

          {isSafe ? (
            <ul className="space-y-1.5 text-xs text-slate-300">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold flex-shrink-0">✔</span>
                <span>Apply directly on the employer's official website whenever possible.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold flex-shrink-0">✔</span>
                <span>Keep your interviews on verified corporate video tools (Teams, Zoom, Google Meet).</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold flex-shrink-0">✔</span>
                <span>Remember: Real companies pay YOU. Never pay money for equipment or training.</span>
              </li>
            </ul>
          ) : isHighRisk ? (
            <ul className="space-y-1.5 text-xs text-rose-200">
              <li className="flex items-start gap-2">
                <span className="text-rose-400 font-bold flex-shrink-0">✖</span>
                <span><strong>DO NOT send any money:</strong> Legitimate employers never ask for advance payments or gift cards.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-rose-400 font-bold flex-shrink-0">✖</span>
                <span><strong>Protect your personal info:</strong> Do not provide bank credentials, copies of ID, or OTP codes.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-rose-400 font-bold flex-shrink-0">✖</span>
                <span><strong>Avoid unofficial chat apps:</strong> Scammers heavily use Telegram, WhatsApp, and SMS for fake job offers.</span>
              </li>
            </ul>
          ) : (
            <ul className="space-y-1.5 text-xs text-slate-300">
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold flex-shrink-0">⚠</span>
                <span>Look up the company on Google or LinkedIn and contact their HR department to verify this posting.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400 font-bold flex-shrink-0">⚠</span>
                <span>Ensure the recruiter's email matches the exact company website domain.</span>
              </li>
            </ul>
          )}
        </div>
      </div>

      {/* ── 5. RED FLAGS & GREEN FLAGS ──────────────────────────────────── */}
      {(result.redFlags?.length > 0 || result.greenFlags?.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
          {result.redFlags?.length > 0 && (
            <div className="p-4 sm:p-5 rounded-2xl bg-rose-500/5 border border-rose-500/20">
              <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <ThumbsDown className="w-4 h-4 flex-shrink-0" />
                <span>Warning Signs Detected ({result.redFlags.length})</span>
              </h4>
              <ul className="space-y-2">
                {result.redFlags.map((flag, i) => (
                  <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                    <span className="text-rose-400 font-bold mt-0.5 flex-shrink-0">•</span>
                    <span className="leading-relaxed break-words">{flag}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.greenFlags?.length > 0 && (
            <div className="p-4 sm:p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
              <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <ThumbsUp className="w-4 h-4 flex-shrink-0" />
                <span>Positive Signals ({result.greenFlags.length})</span>
              </h4>
              <ul className="space-y-2">
                {result.greenFlags.map((flag, i) => (
                  <li key={i} className="text-xs text-slate-300 flex items-start gap-2">
                    <span className="text-emerald-400 font-bold mt-0.5 flex-shrink-0">•</span>
                    <span className="leading-relaxed break-words">{flag}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── 6. AI ANALYSIS SUMMARY ─────────────────────────────────────── */}
      {result.reasons?.length > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-400 flex-shrink-0" />
            <span>Key Takeaways from Analysis</span>
          </h4>
          <ul className="space-y-2">
            {result.reasons.map((r, i) => (
              <li key={i} className="text-xs sm:text-sm text-slate-300 flex items-start gap-2.5">
                <span className="text-violet-400 font-bold mt-0.5 flex-shrink-0">▸</span>
                <span className="leading-relaxed break-words">{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── 7. COLLAPSIBLE TECHNICAL VERIFICATION SECTION ─────────────────── */}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => setShowTechnical(!showTechnical)}
          className="w-full py-3 sm:py-3.5 px-4 sm:px-5 rounded-2xl bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 flex items-center justify-between text-xs sm:text-sm font-semibold text-slate-300 transition-all shadow-lg gap-2 text-left"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Globe className="w-4 h-4 text-cyan-400 flex-shrink-0" />
            <span className="truncate">
              {showTechnical ? 'Hide' : 'Show'} Full Technical Verification Proof (DNS, ATS, Logs)
            </span>
          </div>
          {showTechnical ? <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />}
        </button>

        {showTechnical && (
          <div className="space-y-3.5 sm:space-y-4 mt-3 sm:mt-4 p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-slate-950/60 border border-slate-800/80 w-full overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-2">
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-white">In-Depth Verification Evidence</h4>
                <p className="text-[11px] sm:text-xs text-slate-400">Forensic logs from web search, DNS lookup, ATS boards, and scam registries.</p>
              </div>
              {result.evidenceCoverage != null && (
                <span className="self-start sm:self-auto text-[11px] sm:text-xs px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-medium flex-shrink-0">
                  {result.evidenceCoverage}% Evidence Coverage
                </span>
              )}
            </div>

            {/* Score Breakdown (Points Math) */}
            {scoringBreakdown && (
              <div className="rounded-xl bg-slate-900/40 border border-slate-800/60 p-3 sm:p-4">
                <button
                  type="button"
                  onClick={() => setShowScoreMath(!showScoreMath)}
                  className="w-full flex items-center justify-between text-xs font-semibold text-slate-300 gap-2"
                >
                  <span>100-Point Risk Math Calculation</span>
                  {showScoreMath ? <ChevronUp className="w-3.5 h-3.5 flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />}
                </button>

                {showScoreMath && (
                  <div className="mt-3 pt-3 border-t border-slate-800/60 space-y-2">
                    {scoringBreakdown.categoryScores &&
                      Object.entries(scoringBreakdown.categoryScores).map(([key, { points, max }]) => (
                        <div key={key} className="flex items-center gap-2 sm:gap-3 text-xs">
                          <span className="text-slate-400 w-28 sm:w-36 capitalize truncate flex-shrink-0">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                          <div className="flex-1 h-1.5 rounded-full bg-slate-800 min-w-0">
                            <div
                              className={`h-1.5 rounded-full ${points > 0 ? 'bg-rose-500' : 'bg-slate-700'}`}
                              style={{ width: `${(points / max) * 100}%` }}
                            />
                          </div>
                          <span className="text-slate-400 font-mono w-10 sm:w-12 text-right flex-shrink-0">{points}/{max}</span>
                        </div>
                      ))}

                    {scoringBreakdown.breakdown?.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-slate-800/40 space-y-1">
                        {scoringBreakdown.breakdown.map((item, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs">
                            <span className={`font-mono ${item.points > 0 ? 'text-rose-400 font-bold' : 'text-emerald-400'} flex-shrink-0`}>
                              {item.points > 0 ? `+${item.points}` : '+0'}
                            </span>
                            <span className="text-slate-400 break-words">{item.reason}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Detailed Verification Accordions */}
            {vc && (
              <div className="space-y-2.5 sm:space-y-3">
                {/* Company Verification */}
                <SectionCard
                  icon={Globe}
                  title="Company & Domain Verification"
                  status={vc.company?.overallStatus || 'NOT_CHECKED'}
                  accentColor={vc.company?.overallStatus === 'SUSPICIOUS' ? 'rose' : vc.company?.overallStatus === 'VERIFIED' ? 'emerald' : 'slate'}
                  defaultOpen={true}
                >
                  <div className="mt-2 space-y-0">
                    <p className="text-xs text-slate-400 mb-3 leading-relaxed break-words">{vc.company?.explanation}</p>
                    {vc.company?.identifiedOfficialDomain && (
                      <EvidenceItem label="Identified Domain" value={vc.company.identifiedOfficialDomain} sourceUrl={vc.company.identifiedOfficialUrl} />
                    )}
                    {vc.company?.webSearch && (
                      <EvidenceItem label="Web Search (Tavily)" status={vc.company.webSearch.status} explanation={vc.company.webSearch.explanation} />
                    )}
                    {vc.company?.websiteReachability && (
                      <EvidenceItem label="Website Reachability" status={vc.company.websiteReachability.status} explanation={vc.company.websiteReachability.explanation} sourceUrl={vc.company.identifiedOfficialUrl} />
                    )}
                    {vc.company?.dnsRecords && (
                      <EvidenceItem label="DNS Records" status={vc.company.dnsRecords.status} explanation={vc.company.dnsRecords.explanation} />
                    )}
                    {vc.company?.rdapInfo && (
                      <EvidenceItem
                        label="Domain Registration (RDAP)"
                        status={vc.company.rdapInfo.status}
                        explanation={vc.company.rdapInfo.explanation}
                        sourceUrl={vc.company.rdapInfo.sourceUrl}
                      />
                    )}
                  </div>
                </SectionCard>

                {/* Careers/ATS */}
                <SectionCard
                  icon={Briefcase}
                  title="Official Job Listing Verification (ATS)"
                  status={vc.careers?.overallStatus || 'NOT_CHECKED'}
                  accentColor={vc.careers?.overallStatus === 'VERIFIED_MATCH' ? 'emerald' : vc.careers?.overallStatus === 'SUSPICIOUS' ? 'rose' : 'amber'}
                  defaultOpen={vc.careers?.overallStatus === 'VERIFIED_MATCH'}
                >
                  <div className="mt-2">
                    <p className="text-xs text-slate-400 mb-3 leading-relaxed break-words">{vc.careers?.explanation}</p>
                    {vc.careers?.greenhouse && (
                      <EvidenceItem
                        label="Greenhouse ATS"
                        status={vc.careers.greenhouse.status}
                        explanation={vc.careers.greenhouse.explanation}
                        sourceUrl={vc.careers.greenhouse.matchedUrl}
                      />
                    )}
                    {vc.careers?.lever && (
                      <EvidenceItem
                        label="Lever ATS"
                        status={vc.careers.lever.status}
                        explanation={vc.careers.lever.explanation}
                        sourceUrl={vc.careers.lever.matchedUrl}
                      />
                    )}
                  </div>
                </SectionCard>

                {/* Recruiter */}
                <SectionCard
                  icon={User}
                  title="Recruiter & Contact Verification"
                  status={vc.recruiter?.overallStatus || 'NOT_CHECKED'}
                  accentColor={vc.recruiter?.overallStatus === 'SUSPICIOUS' ? 'rose' : vc.recruiter?.overallStatus === 'VERIFIED' ? 'emerald' : 'slate'}
                  defaultOpen={vc.recruiter?.overallStatus === 'SUSPICIOUS'}
                >
                  <div className="mt-2">
                    <p className="text-xs text-slate-400 mb-3 leading-relaxed break-words">{vc.recruiter?.explanation}</p>
                    {vc.recruiter?.emailDomain && (
                      <EvidenceItem label="Email Domain Check" status={vc.recruiter.emailDomain.status} explanation={vc.recruiter.emailDomain.explanation} />
                    )}
                    {vc.recruiter?.applicationUrl && (
                      <EvidenceItem label="Application URL" status={vc.recruiter.applicationUrl.status} explanation={vc.recruiter.applicationUrl.explanation} />
                    )}
                    {vc.recruiter?.recruiterName && (
                      <EvidenceItem label="Recruiter Name" value={vc.recruiter.recruiterName} />
                    )}
                    {vc.recruiter?.recruiterPhone && (
                      <EvidenceItem label="Recruiter Phone" value={vc.recruiter.recruiterPhone} />
                    )}
                  </div>
                </SectionCard>

                {/* Scam Intelligence */}
                <SectionCard
                  icon={AlertOctagon}
                  title="Scam Intelligence & Fraud Database"
                  status={vc.scam?.overallStatus || 'NOT_CHECKED'}
                  accentColor={vc.scam?.overallStatus === 'SUSPICIOUS' ? 'rose' : 'slate'}
                  defaultOpen={vc.scam?.overallStatus === 'SUSPICIOUS'}
                >
                  <div className="mt-2">
                    <p className="text-xs text-slate-400 mb-3 leading-relaxed break-words">{vc.scam?.explanation}</p>
                    {vc.scam?.advanceFeePatterns && (
                      <EvidenceItem
                        label="Advance-Fee / Scam Patterns"
                        status={vc.scam.advanceFeePatterns.status}
                        explanation={vc.scam.advanceFeePatterns.explanation}
                      />
                    )}
                    {vc.scam?.safeBrowsing && (
                      <EvidenceItem
                        label="Google Safe Browsing"
                        status={vc.scam.safeBrowsing.status}
                        explanation={vc.scam.safeBrowsing.explanation}
                      />
                    )}
                    {vc.scam?.scamReports && (
                      <EvidenceItem
                        label="Scam Report Web Search"
                        status={vc.scam.scamReports.status}
                        explanation={vc.scam.scamReports.explanation}
                      />
                    )}
                  </div>
                </SectionCard>

                {/* Salary */}
                {vc.salary && vc.salary.status !== 'NOT_CHECKED' && (
                  <SectionCard
                    icon={DollarSign}
                    title="Salary Benchmarking"
                    status={vc.salary?.status || 'NOT_CHECKED'}
                    accentColor={vc.salary?.status === 'SUSPICIOUS' ? 'rose' : 'emerald'}
                    defaultOpen={vc.salary?.status === 'SUSPICIOUS'}
                  >
                    <div className="mt-2">
                      {vc.salary.extractedSalary && (
                        <EvidenceItem
                          label="Extracted Salary"
                          value={`${vc.salary.extractedSalary.raw} (${vc.salary.extractedSalary.period})`}
                        />
                      )}
                      <EvidenceItem label="Assessment" status={vc.salary.status} explanation={vc.salary.explanation} />
                    </div>
                  </SectionCard>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Limitations note */}
      {result.limitations && (
        <div className="p-3 sm:p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/60 text-[11px] text-slate-400 flex items-start gap-2">
          <Info className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
          <p className="break-words">{result.limitations}</p>
        </div>
      )}
    </div>
  );
}
