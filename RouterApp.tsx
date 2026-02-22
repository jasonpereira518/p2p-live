/**
 * Root router: student app at /, ops at /ops/*.
 * TODO: Replace fake auth with real auth; keep route structure.
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import { OpsLoginPage } from './pages/ops/OpsLoginPage';
import { OpsAdminPage } from './pages/ops/OpsAdminPage';
import { OpsManagerPage } from './pages/ops/OpsManagerPage';
import { OpsDriverPage } from './pages/ops/OpsDriverPage';
import { RoleGuard } from './ops/RoleGuard';
import { OpsErrorBoundary } from './ops/ErrorBoundary';

export function RouterApp() {
  return (
    <BrowserRouter>
      <div className="h-full flex flex-col min-h-0">
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/ops/login" element={<OpsLoginPage />} />
        <Route
          path="/ops/admin"
          element={
            <RoleGuard allowedRoles={['admin']}>
              <OpsErrorBoundary pageName="Admin">
                <OpsAdminPage />
              </OpsErrorBoundary>
            </RoleGuard>
          }
        />
        <Route
          path="/ops/manager"
          element={
            <RoleGuard allowedRoles={['admin', 'manager']}>
              <OpsErrorBoundary pageName="Manager">
                <OpsManagerPage />
              </OpsErrorBoundary>
            </RoleGuard>
          }
        />
        <Route
          path="/ops/driver"
          element={
            <RoleGuard allowedRoles={['driver']}>
              <OpsErrorBoundary pageName="Driver">
                <OpsDriverPage />
              </OpsErrorBoundary>
            </RoleGuard>
          }
        />
        <Route path="/ops" element={<Navigate to="/ops/login" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </div>
    </BrowserRouter>
  );
}
