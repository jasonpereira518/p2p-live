/**
 * Avatar image with fallback to initials circle on error or missing URL.
 */

import React, { useState } from 'react';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (name[0] ?? '?').toUpperCase();
}

interface AvatarProps {
  src: string | undefined;
  alt: string;
  name: string; // for initials fallback
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-12 h-12 text-base' };

export function Avatar({ src, alt, name, size = 'md', className = '' }: AvatarProps) {
  const [errored, setErrored] = useState(false);
  const useFallback = !src || errored;
  const s = sizeClasses[size];

  if (useFallback) {
    return (
      <div
        className={`${s} rounded-full bg-p2p-blue/20 text-p2p-blue font-semibold flex items-center justify-center shrink-0 ${className}`}
        title={alt}
      >
        {getInitials(name)}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`${s} rounded-full object-cover shrink-0 ${className}`}
      onError={() => setErrored(true)}
    />
  );
}
