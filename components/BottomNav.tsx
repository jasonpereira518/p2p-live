import React from 'react';
import { Home, Map } from 'lucide-react';
import type { ViewState } from '../types';
import './home.css';

interface BottomNavProps { currentView: ViewState; onChangeView: (view: ViewState) => void }
const items = [ { view: 'list', label: 'Home', Icon: Home }, { view: 'map', label: 'Map', Icon: Map } ] as const;
export const BottomNav: React.FC<BottomNavProps> = ({ currentView, onChangeView }) => <nav className="passenger-nav" aria-label="Main navigation">
  {items.map(({view, label, Icon}) => <button key={view} type="button" onClick={() => onChangeView(view)} aria-current={currentView === view ? 'page' : undefined}><Icon size={24} strokeWidth={1.5} aria-hidden="true" /><span>{label}</span></button>)}
</nav>;
