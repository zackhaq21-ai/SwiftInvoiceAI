import { type SVGProps } from 'react';

export function LogoMark({ className = 'h-9 w-9', ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 512 512" fill="none" className={className} xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
        <linearGradient id="boltGrad-mark" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4F46E5" />
          <stop offset="100%" stopColor="#6366F1" />
        </linearGradient>
        <linearGradient id="docGrad-mark" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#4F46E5" />
          <stop offset="100%" stopColor="#6366F1" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill="#F8FAFC" />
      <rect x="156" y="88" width="200" height="336" rx="24" fill="url(#docGrad-mark)" />
      <path d="M188 152 L324 152" stroke="#fff" strokeWidth="12" strokeLinecap="round" opacity="0.7" />
      <path d="M188 192 L324 192" stroke="#fff" strokeWidth="12" strokeLinecap="round" opacity="0.5" />
      <path d="M188 232 L276 232" stroke="#fff" strokeWidth="12" strokeLinecap="round" opacity="0.4" />
      <path d="M300 96 L224 280 L268 280 L240 416 L356 216 L300 216 L340 96 Z" fill="url(#boltGrad-mark)" stroke="#fff" strokeWidth="6" strokeLinejoin="round" />
      <circle cx="372" cy="372" r="48" fill="#0D9488" />
      <path d="M356 372 L368 384 L390 360" stroke="#fff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LogoWordmark({ className = 'h-8 w-auto', showTagline = false }: { className?: string; showTagline?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark className="h-9 w-9 flex-shrink-0" />
      <div className="leading-none">
        <span className="font-bold text-slate-900 text-[15px] tracking-tight block">
          That<span style={{ color: '#4F46E5' }}>Invoice</span>
        </span>
        {showTagline && (
          <span className="text-[10px] text-slate-400 font-medium tracking-wide block mt-0.5">
            Invoice faster. Get paid sooner.
          </span>
        )}
      </div>
    </div>
  );
}

export function LogoMarkDark({ className = 'h-9 w-9', ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 512 512" fill="none" className={className} xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
        <linearGradient id="boltGrad-dark" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#818CF8" />
          <stop offset="100%" stopColor="#A5B4FC" />
        </linearGradient>
        <linearGradient id="docGrad-dark" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#818CF8" />
          <stop offset="100%" stopColor="#A5B4FC" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill="#1E293B" />
      <rect x="156" y="88" width="200" height="336" rx="24" fill="url(#docGrad-dark)" />
      <path d="M188 152 L324 152" stroke="#fff" strokeWidth="12" strokeLinecap="round" opacity="0.7" />
      <path d="M188 192 L324 192" stroke="#fff" strokeWidth="12" strokeLinecap="round" opacity="0.5" />
      <path d="M188 232 L276 232" stroke="#fff" strokeWidth="12" strokeLinecap="round" opacity="0.4" />
      <path d="M300 96 L224 280 L268 280 L240 416 L356 216 L300 216 L340 96 Z" fill="url(#boltGrad-dark)" stroke="#fff" strokeWidth="6" strokeLinejoin="round" />
      <circle cx="372" cy="372" r="48" fill="#14B8A6" />
      <path d="M356 372 L368 384 L390 360" stroke="#fff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LogoWordmarkDark({ className = 'h-8 w-auto', showTagline = false }: { className?: string; showTagline?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoMarkDark className="h-9 w-9 flex-shrink-0" />
      <div className="leading-none">
        <span className="font-bold text-white text-[15px] tracking-tight block">
          That<span style={{ color: '#818CF8' }}>Invoice</span>
        </span>
        {showTagline && (
          <span className="text-[10px] text-slate-400 font-medium tracking-wide block mt-0.5">
            Invoice faster. Get paid sooner.
          </span>
        )}
      </div>
    </div>
  );
}
