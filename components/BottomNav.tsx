import React from 'react';
import { Home, Map, Route } from 'lucide-react';
import type { ViewState } from '../types';
import './home.css';

interface BottomNavProps { currentView: ViewState; onChangeView: (view: ViewState) => void }
const items = [
  { view: 'list', label: 'Home', Icon: Home, fillable: true },
  { view: 'plan', label: 'Plan', Icon: Route, fillable: false },
  { view: 'map', label: 'Map', Icon: Map, fillable: true },
] as const;

export const BottomNav: React.FC<BottomNavProps> = ({ currentView, onChangeView }) => (
  <nav className="passenger-nav" aria-label="Main navigation">
    {items.map(({ view, label, Icon, fillable }) => {
      const active = currentView === view;
      return (
        <button
          key={view}
          type="button"
          onClick={() => onChangeView(view)}
          aria-current={active ? 'page' : undefined}
        >
          <Icon
            size={26}
            strokeWidth={active && fillable ? 0 : active ? 2 : 1.5}
            fill={active && fillable ? 'currentColor' : 'none'}
            aria-hidden="true"
          />
          <span>{label}</span>
        </button>
      );
    })}
  </nav>
);
