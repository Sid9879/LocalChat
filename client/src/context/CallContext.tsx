import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import { CallSession } from '../types';

interface CallContextType {
  activeCall: CallSession | null;
  incomingCall: CallSession | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isAudioMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  startCall: (targetUserId?: string, isVideo?: boolean, conversationId?: string) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  toggleAudio: () => void;
  toggleVideo: () => void;
  toggleScreenShare: () => Promise<void>;
}

const CallContext = createContext<CallContextType | null>(null);

// ICE Configuration
const iceServers: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
  bundlePolicy: 'max-bundle',
};

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { socket } = useSocket();
  const { user } = useAuth();

  const [activeCall, setActiveCall] = useState<CallSession | null>(null);
  const [incomingCall, setIncomingCall] = useState<CallSession | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  const targetUserRef = useRef<string | null>(null);

  // Safely add stream tracks to peer connection without duplicates
  const addStreamTracks = (pc: RTCPeerConnection, stream: MediaStream) => {
    const existingSenders = pc.getSenders();
    stream.getTracks().forEach((track) => {
      const alreadyAdded = existingSenders.some((s) => s.track && s.track.id === track.id);
      if (!alreadyAdded) {
        try {
          pc.addTrack(track, stream);
          console.log(`[WebRTC] Added track to PC: ${track.kind} (${track.id})`);
        } catch (err) {
          console.warn(`[WebRTC] Error adding track ${track.kind}:`, err);
        }
      }
    });
  };

  // Drain queued ICE candidates once remote description is set
  const flushPendingCandidates = async (pc: RTCPeerConnection) => {
    while (pendingCandidates.current.length > 0) {
      const candidate = pendingCandidates.current.shift();
      if (candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
          console.log('[WebRTC] Applied queued ICE candidate');
        } catch (err) {
          console.warn('[WebRTC] Error adding queued ICE candidate:', err);
        }
      }
    }
  };

  // Initialize or get RTCPeerConnection
  const getOrCreatePeerConnection = (targetUserId: string): RTCPeerConnection => {
    if (peerConnection.current) {
      return peerConnection.current;
    }

    console.log('[WebRTC] Creating new RTCPeerConnection for:', targetUserId);
    const pc = new RTCPeerConnection(iceServers);
    targetUserRef.current = targetUserId;

    // Send local ICE candidates to peer
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('webrtc:ice', {
          targetUserId,
          candidate: event.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state changed:', pc.connectionState);
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE Connection state:', pc.iceConnectionState);
    };

    // Receive remote audio/video tracks
    pc.ontrack = (event) => {
      console.log('[WebRTC] Received remote track:', event.track.kind, event.streams);
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      } else {
        setRemoteStream((prevStream) => {
          if (prevStream) {
            prevStream.addTrack(event.track);
            return new MediaStream(prevStream.getTracks());
          }
          return new MediaStream([event.track]);
        });
      }
    };

    peerConnection.current = pc;
    return pc;
  };

  // Cleanup all media streams and peer connection
  const cleanupCall = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    setActiveCall(null);
    setIncomingCall(null);
    setIsAudioMuted(false);
    setIsVideoOff(false);
    setIsScreenSharing(false);
    pendingCandidates.current = [];
    targetUserRef.current = null;
  };

  // Socket event listeners for signaling
  useEffect(() => {
    if (!socket) return;

    // Incoming Call
    const handleIncomingCall = (data: CallSession) => {
      console.log('[Signaling] Incoming call received:', data);
      setIncomingCall(data);
    };

    // Call Accepted
    const handleCallAccepted = async ({ accepterId }: { accepterId: string }) => {
      console.log('[Signaling] Call was accepted by:', accepterId);
      const pc = getOrCreatePeerConnection(accepterId);

      // Add local stream tracks to PC
      const stream = localStreamRef.current || localStream;
      if (stream) {
        addStreamTracks(pc, stream);
      }

      // Create and send SDP Offer
      try {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        await pc.setLocalDescription(offer);
        socket.emit('webrtc:offer', {
          targetUserId: accepterId,
          sdp: offer,
        });
        console.log('[Signaling] Sent SDP Offer to:', accepterId);
      } catch (err) {
        console.error('[WebRTC] Error creating offer:', err);
      }
    };

    // Call Rejected
    const handleCallRejected = ({ reason }: { reason: string }) => {
      alert(`Call declined: ${reason}`);
      cleanupCall();
    };

    // Call Ended
    const handleCallEnded = () => {
      cleanupCall();
    };

    // WebRTC Offer received
    const handleWebRTCOffer = async ({ senderId, sdp }: { senderId: string; sdp: any }) => {
      console.log('[Signaling] Received WebRTC offer from:', senderId);
      const pc = getOrCreatePeerConnection(senderId);

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        await flushPendingCandidates(pc);

        // Add local tracks if available
        const stream = localStreamRef.current || localStream;
        if (stream) {
          addStreamTracks(pc, stream);
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('webrtc:answer', {
          targetUserId: senderId,
          sdp: answer,
        });
        console.log('[Signaling] Sent SDP Answer to:', senderId);
      } catch (err) {
        console.error('[WebRTC] Error handling offer:', err);
      }
    };

    // WebRTC Answer received
    const handleWebRTCAnswer = async ({ senderId, sdp }: { senderId: string; sdp: any }) => {
      console.log('[Signaling] Received WebRTC answer from:', senderId);
      const pc = peerConnection.current || getOrCreatePeerConnection(senderId);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        await flushPendingCandidates(pc);
        console.log('[WebRTC] Set remote description from answer');
      } catch (err) {
        console.error('[WebRTC] Error setting remote description from answer:', err);
      }
    };

    // WebRTC ICE Candidate received
    const handleWebRTCIce = async ({ candidate }: { candidate: any }) => {
      if (!candidate) return;
      const pc = peerConnection.current;
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('[WebRTC] Error adding ICE candidate:', err);
        }
      } else {
        pendingCandidates.current.push(candidate);
      }
    };

    socket.on('call:incoming', handleIncomingCall);
    socket.on('call:accepted', handleCallAccepted);
    socket.on('call:rejected', handleCallRejected);
    socket.on('call:ended', handleCallEnded);
    socket.on('webrtc:offer', handleWebRTCOffer);
    socket.on('webrtc:answer', handleWebRTCAnswer);
    socket.on('webrtc:ice', handleWebRTCIce);

    return () => {
      socket.off('call:incoming', handleIncomingCall);
      socket.off('call:accepted', handleCallAccepted);
      socket.off('call:rejected', handleCallRejected);
      socket.off('call:ended', handleCallEnded);
      socket.off('webrtc:offer', handleWebRTCOffer);
      socket.off('webrtc:answer', handleWebRTCAnswer);
      socket.off('webrtc:ice', handleWebRTCIce);
    };
  }, [socket]);

  // Start Call
  const startCall = async (targetUserId?: string, isVideo = true, conversationId?: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideo ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      });

      localStreamRef.current = stream;
      setLocalStream(stream);
      setActiveCall({
        callerId: user?.id || '',
        callerName: user?.displayName || user?.username || 'You',
        isVideo,
        conversationId,
      });

      if (targetUserId) {
        targetUserRef.current = targetUserId;
      }

      socket?.emit('call:initiate', {
        targetUserId,
        conversationId,
        isVideo,
      });
    } catch (err) {
      console.error('Camera/Mic permission failed:', err);
      alert('Unable to access camera or microphone. Please ensure permissions are granted and you are on HTTPS.');
    }
  };

  // Accept incoming call
  const acceptCall = async () => {
    if (!incomingCall) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: incomingCall.isVideo ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      });

      localStreamRef.current = stream;
      setLocalStream(stream);
      setActiveCall(incomingCall);
      targetUserRef.current = incomingCall.callerId;

      const pc = getOrCreatePeerConnection(incomingCall.callerId);
      addStreamTracks(pc, stream);

      socket?.emit('call:accept', {
        callerId: incomingCall.callerId,
        conversationId: incomingCall.conversationId,
      });

      setIncomingCall(null);
    } catch (err) {
      console.error('Failed to accept call:', err);
      alert('Could not access microphone or camera.');
      rejectCall();
    }
  };

  // Reject incoming call
  const rejectCall = () => {
    if (incomingCall) {
      socket?.emit('call:reject', {
        callerId: incomingCall.callerId,
        reason: 'Call declined',
      });
      setIncomingCall(null);
    }
  };

  // End Call
  const endCall = () => {
    if (activeCall && socket) {
      socket.emit('call:end', {
        targetUserId: targetUserRef.current,
        conversationId: activeCall.conversationId,
      });
    }
    cleanupCall();
  };

  // Toggle Mute Audio
  const toggleAudio = () => {
    const stream = localStreamRef.current || localStream;
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
      }
    }
  };

  // Toggle Camera
  const toggleVideo = () => {
    const stream = localStreamRef.current || localStream;
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  // Toggle Screen Share
  const toggleScreenShare = async () => {
    if (!peerConnection.current) return;

    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];

        const senders = peerConnection.current.getSenders();
        const videoSender = senders.find((s) => s.track && s.track.kind === 'video');

        if (videoSender) {
          await videoSender.replaceTrack(screenTrack);
        }

        screenTrack.onended = () => {
          const stream = localStreamRef.current || localStream;
          if (stream) {
            const originalVideoTrack = stream.getVideoTracks()[0];
            if (videoSender && originalVideoTrack) {
              videoSender.replaceTrack(originalVideoTrack);
            }
          }
          setIsScreenSharing(false);
        };

        setIsScreenSharing(true);
      } catch (err) {
        console.error('Screen sharing error:', err);
      }
    } else {
      const stream = localStreamRef.current || localStream;
      if (stream) {
        const videoSender = peerConnection.current
          .getSenders()
          .find((s) => s.track && s.track.kind === 'video');
        const originalVideoTrack = stream.getVideoTracks()[0];
        if (videoSender && originalVideoTrack) {
          videoSender.replaceTrack(originalVideoTrack);
        }
      }
      setIsScreenSharing(false);
    }
  };

  return (
    <CallContext.Provider
      value={{
        activeCall,
        incomingCall,
        localStream,
        remoteStream,
        isAudioMuted,
        isVideoOff,
        isScreenSharing,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleAudio,
        toggleVideo,
        toggleScreenShare,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) throw new Error('useCall must be used within a CallProvider');
  return context;
};
