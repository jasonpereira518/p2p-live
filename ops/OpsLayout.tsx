import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getSession, logout } from './auth';

interface OpsLayoutProps {
  children: React.ReactNode;
  title: string;
}

export function OpsLayout({ children, title }: OpsLayoutProps) {
  const session = getSession();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/ops/login');
  };

  return (
    <div className="h-screen max-h-screen flex flex-col bg-gray-50 overflow-hidden">
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-lg font-black text-p2p-blue tracking-tight">
            P<span className="text-p2p-red">2</span>P <span className="text-p2p-black">Live</span>
          </Link>
          <span className="text-gray-300">|</span>
          <span className="font-bold text-gray-800">P2P Admin</span>
          <span className="text-gray-300">·</span>
          <span className="text-gray-600">{title}</span>
        </div>
        <div className="flex items-center gap-3">
          {session && (
            <>
              <span className="text-sm text-gray-600">{session.user.name}</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-p2p-light-blue/50 text-p2p-blue capitalize">
                {session.user.role}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-p2p-light-red/30 hover:text-p2p-red focus:outline-none focus:ring-2 focus:ring-p2p-blue/30"
              >
                Logout
              </button>
            </>
          )}
        </div>
      </header>
      <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">{children}</main>
    </div>
  );
}
