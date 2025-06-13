import React from 'react';
import { Session } from '../types/session';
import { AlertCircle, CheckCircle, Loader2, PauseCircle, Bell } from 'lucide-react';

interface StatusIndicatorProps {
  session: Session;
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
  showProgress?: boolean;
}

export function StatusIndicator({ 
  session, 
  size = 'medium', 
  showText = false, 
  showProgress = false 
}: StatusIndicatorProps) {
  const getStatusConfig = (status: Session['status']) => {
    switch (status) {
      case 'initializing':
        return {
          status: 'initializing',
          color: 'bg-blue-500',
          textColor: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          icon: Loader2,
          text: 'Initializing',
          animated: true,
          spin: true,
        };
      case 'running':
        return {
          status: 'running',
          color: 'bg-green-500',
          textColor: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          icon: Loader2,
          text: 'Running',
          animated: true,
          spin: true,
        };
      case 'waiting':
        return {
          status: 'waiting',
          color: 'bg-amber-500',
          textColor: 'text-amber-600',
          bgColor: 'bg-amber-50',
          borderColor: 'border-amber-200',
          icon: PauseCircle,
          text: 'Waiting for input',
          animated: true,
          pulse: true,
        };
      case 'stopped':
        return {
          status: 'stopped',
          color: 'bg-emerald-500',
          textColor: 'text-emerald-600',
          bgColor: 'bg-emerald-50',
          borderColor: 'border-emerald-200',
          icon: CheckCircle,
          text: 'Completed',
          animated: false,
        };
      case 'completed_unviewed':
        return {
          status: 'completed_unviewed',
          color: 'bg-blue-500',
          textColor: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          icon: Bell,
          text: 'New activity',
          animated: true,
          pulse: true,
        };
      case 'error':
        return {
          status: 'error',
          color: 'bg-red-500',
          textColor: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          icon: AlertCircle,
          text: 'Error',
          animated: false,
        };
      default:
        return {
          status: 'unknown',
          color: 'bg-gray-400',
          textColor: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          icon: AlertCircle,
          text: 'Unknown',
          animated: false,
        };
    }
  };

  const getSizeClasses = (size: string) => {
    switch (size) {
      case 'small':
        return {
          dot: 'w-2 h-2',
          container: 'w-3 h-3',
          text: 'text-xs',
          spacing: 'space-x-1',
        };
      case 'large':
        return {
          dot: 'w-4 h-4',
          container: 'w-5 h-5',
          text: 'text-sm',
          spacing: 'space-x-3',
        };
      default: // medium
        return {
          dot: 'w-3 h-3',
          container: 'w-4 h-4',
          text: 'text-sm',
          spacing: 'space-x-2',
        };
    }
  };

  const config = getStatusConfig(session.status);
  const sizeClasses = getSizeClasses(size);

  const estimateProgress = (): number => {
    if (session.status === 'stopped') return 100;
    if (session.status === 'error') return 0;
    if (session.status === 'waiting') return 75;
    if (session.status === 'running') return 50;
    if (session.status === 'initializing') return 25;
    return 0;
  };


  // When showText is true, render as a chip
  if (showText) {
    return (
      <div className={`flex items-center ${sizeClasses.spacing}`}>
        {/* Status Chip */}
        <div 
          className={`
            inline-flex items-center gap-2
            px-3 py-1.5 
            rounded-full 
            ${config.bgColor} 
            border 
            ${config.borderColor}
            ${config.animated ? 'relative overflow-hidden' : ''}
            transition-all duration-200
          `}
        >
          {/* Animated background effect for active states */}
          {config.animated && (
            <div className="absolute inset-0 -z-10">
              <div 
                className={`
                  absolute inset-0 
                  ${config.color} 
                  opacity-20 
                  animate-pulse
                `} 
              />
              {(config.status === 'running' || config.status === 'initializing') && (
                <div 
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"
                  style={{
                    animation: 'shimmer 2s infinite',
                  }}
                />
              )}
            </div>
          )}
          
          {/* Status icon and text */}
          {React.createElement(config.icon, {
            className: `w-4 h-4 ${config.textColor} ${config.spin ? 'animate-spin' : ''}` 
          })}
          <span className={`${sizeClasses.text} font-medium ${config.textColor}`}>
            {config.text}
          </span>
          
          {/* Pulsing dot for waiting/new activity status */}
          {config.pulse && (
            <div className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.color} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${config.color}`}></span>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        {showProgress && (
          <div className="flex-1 ml-2">
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div
                className={`${config.color} h-1.5 rounded-full transition-all duration-1000 ease-out`}
                style={{ width: `${estimateProgress()}%` }}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // Original dot indicator for when showText is false
  return (
    <div className={`flex items-center ${sizeClasses.spacing}`}>
      {/* Status Indicator Dot */}
      <div className={`relative ${sizeClasses.container} flex items-center justify-center`}>
        <div
          className={`
            ${sizeClasses.dot} 
            ${config.color} 
            rounded-full 
            ${config.animated ? 'animate-pulse' : ''}
            ${config.pulse ? 'animate-ping' : ''}
          `}
        />
        {config.pulse && (
          <div
            className={`
              absolute inset-0 
              ${sizeClasses.dot} 
              ${config.color} 
              rounded-full 
              opacity-75
            `}
          />
        )}
      </div>
    </div>
  );
}