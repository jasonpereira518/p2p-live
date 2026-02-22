/**
 * Protects /ops/* routes: redirect to /ops/login if no session, or to correct dashboard if wrong role.
 * TODO: Integrate with real auth (e.g. token refresh, 401 redirect).
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getSession, getDashboardPath, type Role } from './auth';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: Role[];
}

export function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
  const location = useLocation();
  const session = getSession();

  if (!session) {
    return <Navigate to="/ops/login" state={{ from: location }} replace />;
  }

  // Student has no ops dashboard; send to main app
  if (session.user.role === 'student') {
    return <Navigate to="/" replace />;
  }

  if (!allowedRoles.includes(session.user.role)) {
    const correctPath = getDashboardPath(session.user.role);
    return <Navigate to={correctPath} replace />;
  }

  return <>{children}</>;
}
