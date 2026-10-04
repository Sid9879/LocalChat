import React from 'react';
import { useCall } from '../context/CallContext';
import { Phone, PhoneOff, Video } from 'lucide-react';

export const IncomingCallModal: React.FC = () => {
  const { incomingCall, acceptCall, rejectCall } = useCall();

  if (!incomingCall) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center shadow-2xl flex flex-col items-center animate-bounce-short">
        <div className="w-20 h-20 rounded-3xl bg-indigo-600/20 border-2 border-indigo-500/40 flex items-center justify-center text-3xl font-bold text-indigo-400 mb-4 shadow-inner">
          {incomingCall.callerName.charAt(0).toUpperCase()}
        </div>

        <h3 className="text-xl font-bold text-white mb-1">{incomingCall.callerName}</h3>
        <p className="text-sm text-slate-400 mb-6 flex items-center gap-1.5">
          {incomingCall.isVideo ? (
            <>
              <Video className="w-4 h-4 text-indigo-400" /> Incoming Video Call...
            </>
          ) : (
            <>
              <Phone className="w-4 h-4 text-emerald-400" /> Incoming Voice Call...
            </>
          )}
        </p>

        <div className="flex items-center gap-6">
          {/* Decline */}
          <button
            onClick={rejectCall}
            className="flex flex-col items-center gap-1.5 text-slate-400 hover:text-rose-400 cursor-pointer"
          >
            <div className="w-14 h-14 rounded-2xl bg-rose-500/20 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/30 flex items-center justify-center transition-all shadow-lg">
              <PhoneOff className="w-6 h-6" />
            </div>
            <span className="text-xs">Decline</span>
          </button>

          {/* Accept */}
          <button
            onClick={acceptCall}
            className="flex flex-col items-center gap-1.5 text-slate-400 hover:text-emerald-400 cursor-pointer"
          >
            <div className="w-14 h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center transition-all shadow-lg shadow-emerald-500/30">
              {incomingCall.isVideo ? <Video className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
            </div>
            <span className="text-xs">Accept</span>
          </button>
        </div>
      </div>
    </div>
  );
};
