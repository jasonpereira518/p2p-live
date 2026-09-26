/**
 * Ops routes under /ops/*. Loaded only when the ops build flag is on (see RouterApp).
 * TODO: Replace fake auth with real auth; keep route structure.
 */

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { OpsLoginPage } from '../pages/ops/OpsLoginPage';
import { OpsAdminPage } from '../pages/ops/OpsAdminPage';
import { OpsManagerPage } from '../pages/ops/OpsManagerPage';
import { OpsDriverPage } from '../pages/ops/OpsDriverPage';
import { RoleGuard } from './RoleGuard';
import { OpsErrorBoundary } from './ErrorBoundary';

export default function OpsRoutes() {
  return (
    <Routes>
      <Route path="login" element={<OpsLoginPage />} />
      <Route
        path="admin"
        element={
          <RoleGuard allowedRoles={['admin']}>
            <OpsErrorBoundary pageName="Admin">
              <OpsAdminPage />
            </OpsErrorBoundary>
          </RoleGuard>
        }
      />
      <Route
        path="manager"
        element={
          <RoleGuard allowedRoles={['admin', 'manager']}>
            <OpsErrorBoundary pageName="Manager">
              <OpsManagerPage />
            </OpsErrorBoundary>
          </RoleGuard>
        }
      />
      <Route
        path="driver"
        element={
          <RoleGuard allowedRoles={['driver']}>
            <OpsErrorBoundary pageName="Driver">
              <OpsDriverPage />
            </OpsErrorBoundary>
          </RoleGuard>
        }
      />
      <Route path="*" element={<Navigate to="/ops/login" replace />} />
    </Routes>
  );
}
