/**
 * Shared header: logo and, in the ops build only, the P2P Login / account area.
 */

import React, { Suspense, lazy } from 'react';
import { Link } from 'react-router-dom';
import { LocateFixed } from 'lucide-react';

// The rider build has no login; AccountMenu (and ops/auth) is left out of it entirely.
const AccountMenu = __OPS_ENABLED__ ? lazy(() => import('./AccountMenu')) : null;

interface AppHeaderProps {
  loadingLoc?: boolean;
  compact?: boolean;
  home?: boolean;
}

export function AppHeader({ loadingLoc = false, compact = false, home = false }: AppHeaderProps) {
  return (
    <header className={`bg-white border-b border-gray-100 px-4 flex justify-between items-center z-10 shrink-0 ${home ? `home-header ${compact ? 'compact-passenger-header' : ''}` : compact ? 'min-h-16 py-2' : 'pt-12 pb-3 shadow-sm'}`} style={compact ? { paddingTop: 'max(8px, env(safe-area-inset-top))' } : undefined}>
      <div className="flex items-center gap-2">
        <Link
          to="/"
          className={`cursor-pointer flex ${compact ? 'flex-col items-start gap-0' : 'items-center gap-2'} outline-none focus:ring-2 focus:ring-p2p-blue focus:ring-offset-2 rounded`}
          aria-label="Go to homepage"
        >
          {home ? <h1 className="home-wordmark text-p2p-blue"><em>P<span className="text-p2p-red">2</span>P</em> <span className="home-live text-p2p-black">Live</span></h1> : <>
          <h1 className="text-2xl font-black text-p2p-blue tracking-tight">
            P<span className="text-p2p-red">2</span>P <span className="text-p2p-black">Live</span>
          </h1>
          <span className={compact ? 'text-[10px] text-slate-500' : 'px-2 py-0.5 bg-p2p-light-red/30 text-p2p-red text-[10px] font-bold uppercase rounded-full tracking-wide'}>
            UNC Chapel Hill
          </span>
          </>}
        </Link>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        {loadingLoc && <LocateFixed className="animate-spin text-gray-300 shrink-0" size={20} aria-hidden />}
        {AccountMenu && <Suspense fallback={null}><AccountMenu home={home} /></Suspense>}
      </div>
    </header>
  );
}
