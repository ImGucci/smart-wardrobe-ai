import React, { useState, useRef } from 'react';
import { UserProfile } from '../types';
import { Header } from '../components/Header';
import { UserCircleIcon, CameraIcon } from '@heroicons/react/24/solid';

interface ProfileViewProps {
  profile: UserProfile;
  onUpdate: (profile: UserProfile) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ profile, onUpdate }) => {
  const [formData, setFormData] = useState<UserProfile>(profile);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (field: keyof UserProfile, value: string) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    onUpdate(updated);
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        handleChange('avatarImage', base64);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="pb-24 min-h-screen bg-gray-50">
      <Header title="My Profile" subtitle="Help AI understand your fit" />
      
      <div className="px-6 py-8">
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-6">
            
          <div className="flex flex-col items-center mb-6">
            <div 
              className="relative w-32 h-32 cursor-pointer group"
              onClick={() => fileInputRef.current?.click()}
            >
              {formData.avatarImage ? (
                <img 
                  src={`data:image/jpeg;base64,${formData.avatarImage}`} 
                  alt="Avatar" 
                  className="w-full h-full rounded-full object-cover border-4 border-indigo-50 shadow-md"
                />
              ) : (
                <div className="w-full h-full bg-indigo-50 rounded-full flex items-center justify-center border-4 border-white shadow-md">
                    <UserCircleIcon className="w-20 h-20 text-indigo-300" />
                </div>
              )}
              
              <div className="absolute bottom-0 right-0 bg-indigo-600 text-white p-2 rounded-full shadow-lg border-2 border-white group-hover:scale-110 transition-transform">
                <CameraIcon className="w-5 h-5" />
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-3 font-medium">Tap to upload your photo</p>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*"
              onChange={handleAvatarUpload} 
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="mt-2 w-full border-b border-gray-200 py-2 focus:outline-none focus:border-indigo-600 bg-transparent font-medium text-gray-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Height</label>
                <input
                type="text"
                value={formData.height}
                onChange={(e) => handleChange('height', e.target.value)}
                placeholder="e.g. 170cm"
                className="mt-2 w-full border-b border-gray-200 py-2 focus:outline-none focus:border-indigo-600 bg-transparent font-medium text-gray-900"
                />
            </div>
            <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Weight</label>
                <input
                type="text"
                value={formData.weight}
                onChange={(e) => handleChange('weight', e.target.value)}
                placeholder="e.g. 65kg"
                className="mt-2 w-full border-b border-gray-200 py-2 focus:outline-none focus:border-indigo-600 bg-transparent font-medium text-gray-900"
                />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Gender</label>
            <select
              value={formData.gender}
              onChange={(e) => handleChange('gender', e.target.value)}
              className="mt-2 w-full border-b border-gray-200 py-2 focus:outline-none focus:border-indigo-600 bg-transparent font-medium text-gray-900"
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Non-binary">Non-binary</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Skin Tone Description</label>
            <input
              type="text"
              value={formData.skinTone}
              onChange={(e) => handleChange('skinTone', e.target.value)}
              placeholder="e.g. Medium tan, Light, Dark"
              className="mt-2 w-full border-b border-gray-200 py-2 focus:outline-none focus:border-indigo-600 bg-transparent font-medium text-gray-900"
            />
            <p className="text-[10px] text-gray-400 mt-1">Used for AI visualization accuracy</p>
          </div>

        </div>
        
        <div className="mt-6 text-center">
            <p className="text-xs text-gray-400">All data is stored locally on your device.</p>
        </div>
      </div>
    </div>
  );
};