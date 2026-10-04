import React, { useEffect, useRef } from 'react';
import { useCall } from '../context/CallContext';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Monitor,
  Shield,
  ScreenShare,
} from 'lucide-react';

export const VideoCallModal: React.FC = () => {
  const {
    activeCall,
    localStream,
    remoteStream,
    screenStream,
    isAudioMuted,
    isVideoOff,
    isScreenSharing,
    isRemoteScreenSharing,
    endCall,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
  } = useCall();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // Attach local camera stream to local video element
  useEffect(() => {
    if (localVideoRef.current && localStream && !isScreenSharing) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch((e) => console.log('Local video play error:', e));
    }
  }, [localStream, isScreenSharing]);

  // Attach remote stream to dedicated audio element (guarantees sound on both voice & video calls)
  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch((err) => {
        console.warn('Remote audio autoplay prevented:', err);
      });
    }
  }, [remoteStream]);

  // Attach remote stream to remote video element
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch((err) => {
        console.warn('Remote video autoplay prevented:', err);
      });
    }
  }, [remoteStream, activeCall?.isVideo, isRemoteScreenSharing]);

  if (!activeCall) return null;

  const showVideoStage = activeCall.isVideo || isRemoteScreenSharing || isScreenSharing;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4">
      {/* Hidden dedicated audio element to guarantee remote voice playback */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      <div className="w-full max-w-5xl h-[85vh] bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col relative">
        {/* Top bar info */}
        <div className="absolute top-4 left-6 z-20 flex items-center gap-2 bg-slate-900/60 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-slate-700/50">
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs font-medium text-slate-200">
            {isRemoteScreenSharing
              ? 'Desktop Screen Share'
              : activeCall.isVideo
              ? 'Direct WebRTC Video Stream'
              : 'Direct WebRTC Audio Stream'}{' '}
            (LAN P2P)
          </span>
        </div>

        {/* Remote Screen Share Active Banner */}
        {isRemoteScreenSharing && (
          <div className="absolute top-4 right-6 z-20 flex items-center gap-2 bg-indigo-600/90 backdrop-blur-md px-4 py-1.5 rounded-full border border-indigo-400/50 shadow-lg animate-pulse">
            <ScreenShare className="w-4 h-4 text-white" />
            <span className="text-xs font-medium text-white">
              {activeCall.callerName} is sharing their screen
            </span>
          </div>
        )}

        {/* Video Stage */}
        <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
          {/* Audio Call UI (shown only when no video or screen share is active) */}
          {!showVideoStage ? (
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-24 h-24 rounded-full bg-indigo-600/30 border-2 border-indigo-500/50 flex items-center justify-center text-3xl font-bold text-indigo-300 animate-pulse mb-4">
                {activeCall.callerName.charAt(0).toUpperCase()}
              </div>
              <h3 className="text-lg font-semibold text-white">{activeCall.callerName}</h3>
              <p className="text-xs text-emerald-400 mt-1">
                {remoteStream ? 'Audio Connected' : 'Connecting Audio...'}
              </p>
            </div>
          ) : (
            /* Video / Screen Share Stage */
            <>
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full ${
                  isRemoteScreenSharing ? 'object-contain bg-slate-950' : 'object-cover'
                } ${!remoteStream ? 'hidden' : ''}`}
              />
              {!remoteStream && (
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl font-bold text-slate-400 animate-bounce mb-3">
                    {activeCall.callerName.charAt(0).toUpperCase()}
                  </div>
                  <h3 className="text-base font-semibold text-white">Calling {activeCall.callerName}...</h3>
                  <p className="text-xs text-slate-400 mt-1">Establishing peer-to-peer connection</p>
                </div>
              )}
            </>
          )}

          {/* Local Video Picture-in-Picture */}
          {activeCall.isVideo && (
            <div className="absolute bottom-6 right-6 w-56 h-36 bg-slate-900 border-2 border-slate-700 rounded-2xl overflow-hidden shadow-2xl z-20">
              {isScreenSharing ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-indigo-950/80 text-center p-2 text-indigo-200">
                  <ScreenShare className="w-6 h-6 mb-1 text-indigo-400 animate-pulse" />
                  <span className="text-[11px] font-medium">You are sharing your screen</span>
                </div>
              ) : (
                <>
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : ''}`}
                  />
                  {isVideoOff && (
                    <div className="w-full h-full flex flex-col items-center justify-center text-xs text-slate-400 bg-slate-800">
                      <VideoOff className="w-6 h-6 mb-1 text-slate-500" />
                      <span>Camera off</span>
                    </div>
                  )}
                  <div className="absolute bottom-1.5 left-2 text-[10px] bg-black/60 px-1.5 py-0.5 rounded text-white font-medium">
                    You
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Call Controls Bar */}
        <div className="h-20 bg-slate-900 border-t border-slate-800 px-6 flex items-center justify-center gap-4 shrink-0">
          {/* Mute Audio */}
          <button
            onClick={toggleAudio}
            className={`p-3.5 rounded-2xl transition-all cursor-pointer ${
              isAudioMuted
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
            title={isAudioMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          >
            {isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Toggle Camera (in video calls) */}
          {activeCall.isVideo && (
            <button
              onClick={toggleVideo}
              className={`p-3.5 rounded-2xl transition-all cursor-pointer ${
                isVideoOff
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
              title={isVideoOff ? 'Turn Video On' : 'Turn Video Off'}
            >
              {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </button>
          )}

          {/* Toggle Screen Share */}
          <button
            onClick={toggleScreenShare}
            className={`p-3.5 rounded-2xl transition-all cursor-pointer flex items-center gap-2 ${
              isScreenSharing
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
            title={isScreenSharing ? 'Stop Screen Sharing' : 'Share Screen'}
          >
            <Monitor className="w-5 h-5" />
            {isScreenSharing && <span className="text-xs font-semibold pr-1">Stop Share</span>}
          </button>

          {/* End Call Button */}
          <button
            onClick={endCall}
            className="p-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-lg shadow-rose-600/30 cursor-pointer"
            title="End Call"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
