import React, { useState, useEffect } from 'react';
import { X, MessageCircle } from 'lucide-react';

interface DiscordPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DiscordPopup: React.FC<DiscordPopupProps> = ({ isOpen, onClose }) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    // Check if "don't show again" was previously selected from database
    const loadPreference = async () => {
      if (window.electron?.invoke) {
        const result = await window.electron.invoke('preferences:get', 'hide_discord');
        setDontShowAgain(result?.data === 'true');
      }
    };
    loadPreference();
  }, []);

  const handleClose = async () => {
    if (window.electron?.invoke) {
      await window.electron.invoke('preferences:set', 'hide_discord', dontShowAgain ? 'true' : 'false');
    }
    onClose();
  };

  const handleRemindLater = async () => {
    // Just close without setting the hide flag
    if (window.electron?.invoke) {
      await window.electron.invoke('preferences:set', 'hide_discord', 'false');
    }
    onClose();
  };

  const handleJoinDiscord = async () => {
    // Only try to open external link if Electron API is available
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal('https://discord.gg/XrVa6q7DPY');
    } else {
      // Fallback for web/development mode
      window.open('https://discord.gg/XrVa6q7DPY', '_blank');
    }
    if (dontShowAgain && window.electron?.invoke) {
      await window.electron.invoke('preferences:set', 'hide_discord', 'true');
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#1e1e1e] rounded-xl border border-gray-700 max-w-md w-full shadow-2xl transform transition-all">
        {/* Header */}
        <div className="relative overflow-hidden rounded-t-xl">
          <div className="absolute inset-0 bg-gradient-to-r from-[#5865F2] to-[#7289DA] opacity-90" />
          <div className="relative px-6 py-8 text-center">
            <div className="flex items-center justify-center mb-4">
              <MessageCircle className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Join the Crystal Community!</h2>
            <p className="text-white/90">Connect with other Crystal users, get help, and stay updated</p>
          </div>
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <div className="space-y-4 mb-6">
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 rounded-full bg-[#5865F2] mt-2 flex-shrink-0" />
              <p className="text-gray-300">Get help with Crystal and Claude Code</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 rounded-full bg-[#5865F2] mt-2 flex-shrink-0" />
              <p className="text-gray-300">Share your workflows and learn from others</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 rounded-full bg-[#5865F2] mt-2 flex-shrink-0" />
              <p className="text-gray-300">Be the first to know about updates and features</p>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={handleJoinDiscord}
              className="w-full px-4 py-3 bg-[#5865F2] hover:bg-[#4752C4] text-white font-medium rounded-lg transition-colors flex items-center justify-center space-x-2"
            >
              <MessageCircle className="w-5 h-5" />
              <span>Join Discord Server</span>
            </button>
            
            <button
              onClick={handleRemindLater}
              className="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium rounded-lg transition-colors"
            >
              Remind Me Later
            </button>
          </div>

          {/* Don't show again button */}
          <div className="mt-6 flex justify-center">
            <button
              onClick={async () => {
                const newValue = !dontShowAgain;
                setDontShowAgain(newValue);
                if (window.electron?.invoke) {
                  await window.electron.invoke('preferences:set', 'hide_discord', newValue ? 'true' : 'false');
                }
                // Close the popup when don't show again is clicked and set to true
                if (newValue) {
                  onClose();
                }
              }}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                dontShowAgain
                  ? 'bg-gray-700 text-gray-100 hover:bg-gray-600'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
              }`}
            >
              {dontShowAgain ? "Will hide permanently" : "Don't show this again"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};