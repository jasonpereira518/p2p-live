/**
 * Ops layout: fixed OpsHeader + scrollable main. Used by /ops/admin, /ops/manager, /ops/driver.
 * If current user is a driver who was removed from peopleStore, force logout and redirect.
 */

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSession, logout } from './auth';
import { getPerson } from './peopleStore';
import { OpsHeader, OPS_HEADER_HEIGHT } from '../components/ops/OpsHeader';

interface OpsLayoutProps {
  children: React.ReactNode;
  title: string;
}

export function OpsLayout({ children, title }: OpsLayoutProps) {
  const navigate = useNavigate();
  const session = getSession();

  useEffect(() => {
    if (!session) return;
    if (session.user.role === 'driver') {
      const person = getPerson(session.user.id);
      if (!person) {
        logout();
        navigate('/ops/login', { state: { message: 'Your account was removed. Please contact a manager.' } });
      }
    }
  }, [session, navigate]);

  return (
    <div className="h-screen max-h-screen flex flex-col bg-gray-50 overflow-hidden">
      <OpsHeader />
      <main
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
        style={{ paddingTop: session ? OPS_HEADER_HEIGHT : 0 }}
      >
        {children}
      </main>
    </div>
  );
}
