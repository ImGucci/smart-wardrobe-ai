import React from 'react';
import { AppView } from '../types';
import { ArchiveBoxIcon, PlusCircleIcon, SparklesIcon, UserIcon } from '@heroicons/react/24/outline';
import { ArchiveBoxIcon as ArchiveBoxIconSolid, PlusCircleIcon as PlusCircleIconSolid, SparklesIcon as SparklesIconSolid, UserIcon as UserIconSolid } from '@heroicons/react/24/solid';

interface NavBarProps {
  currentView: AppView;
  onChange: (view: AppView) => void;
}

export const NavBar: React.FC<NavBarProps> = ({ currentView, onChange }) => {
  const items = [
    { view: AppView.WARDROBE, label: 'Wardrobe', icon: ArchiveBoxIcon, activeIcon: ArchiveBoxIconSolid },
    { view: AppView.STYLIST, label: 'Stylist', icon: SparklesIcon, activeIcon: SparklesIconSolid },
    { view: AppView.ADD_ITEM, label: 'Add', icon: PlusCircleIcon, activeIcon: PlusCircleIconSolid },
    { view: AppView.PROFILE, label: 'Profile', icon: UserIcon, activeIcon: UserIconSolid },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 pb-safe pt-2 px-6 h-20 flex justify-between items-start z-50">
      {items.map((item) => {
        const isActive = currentView === item.view;
        const Icon = isActive ? item.activeIcon : item.icon;
        return (
          <button
            key={item.view}
            onClick={() => onChange(item.view)}
            className={`flex flex-col items-center justify-center w-16 transition-colors duration-200 ${
              isActive ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <Icon className="w-7 h-7 mb-1" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};
