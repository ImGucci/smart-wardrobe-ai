import React from 'react';

export const Header: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => {
  return (
    <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-100 px-6 py-4 pt-safe">
      <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{title}</h1>
      {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
};