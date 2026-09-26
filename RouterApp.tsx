/**
 * Root router: student app at /. Ops dashboards at /ops/* only when built with
 * VITE_ENABLE_OPS=true; otherwise they are left out of the build and /ops/* goes home.
 */

import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import { TransitProvider } from './context/TransitProvider';

const OpsRoutes = __OPS_ENABLED__ ? lazy(() => import('./ops/OpsRoutes')) : null;

export function RouterApp() {
  return (
    <BrowserRouter>
      <TransitProvider>
        <div className="h-full flex flex-col min-h-0">
        <Routes>
          <Route path="/" element={<App />} />
          {OpsRoutes && (
            <Route path="/ops/*" element={<Suspense fallback={null}><OpsRoutes /></Suspense>} />
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </div>
      </TransitProvider>
    </BrowserRouter>
  );
}
