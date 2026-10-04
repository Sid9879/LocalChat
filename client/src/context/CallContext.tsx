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

// ICE Servers configuration (STUN for NAT resolution, LAN will connect directly)
const iceServers: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
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
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  const targetUserRef = useRef<string | null>(null);

  // Initialize or get RTCPeerConnection
  const getOrCreatePeerConnection = (targetUserId: string): RTCPeerConnection => {
    if (peerConnection.current) {
      return peerConnection.current;
    }

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

    // Receive remote audio/video tracks
    pc.ontrack = (event) => {
      console.log('Received remote track:', event.track.kind);
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      } else {
        const stream = new MediaStream([event.track]);
        setRemoteStream(stream);
      }
    };

    peerConnection.current = pc;
    return pc;
  };

  // Cleanup all media streams and peer connection
  const cleanupCall = () => {
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
    socket.on('call:incoming', (data: CallSession) => {
      console.log('Incoming call received:', data);
      setIncomingCall(data);
    });

    // Call Accepted
    socket.on('call:accepted', async ({ accepterId }: { accepterId: string }) => {
      console.log('Call was accepted by:', accepterId);
      const pc = getOrCreatePeerConnection(accepterId);

      // Add local stream tracks to PC
      if (localStream) {
        localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
      }

      // Create and send SDP Offer
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('webrtc:offer', {
          targetUserId: accepterId,
          sdp: offer,
        });
      } catch (err) {
        console.error('Error creating offer:', err);
      }
    });

    // Call Rejected
    socket.on('call:rejected', ({ reason }: { reason: string }) => {
      alert(`Call declined: ${reason}`);
      cleanupCall();
    });

    // Call Ended
    socket.on('call:ended', () => {
      cleanupCall();
    });

    // WebRTC Offer received
    socket.on('webrtc:offer', async ({ senderId, sdp }) => {
      console.log('Received WebRTC offer from:', senderId);
      const pc = getOrCreatePeerConnection(senderId);

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));

        // Flush pending ICE candidates
        while (pendingCandidates.current.length > 0) {
          const candidate = pendingCandidates.current.shift();
          if (candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }

        // Add local tracks if available
        if (localStream) {
          localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('webrtc:answer', {
          targetUserId: senderId,
          sdp: answer,
        });
      } catch (err) {
        console.error('Error handling offer:', err);
      }
    });

    // WebRTC Answer received
    socket.on('webrtc:answer', async ({ senderId, sdp }) => {
      console.log('Received WebRTC answer from:', senderId);
      if (peerConnection.current) {
        try {
          await peerConnection.current.setRemoteDescription(new RTCSessionDescription(sdp));

          // Flush pending candidates
          while (pendingCandidates.current.length > 0) {
            const candidate = pendingCandidates.current.shift();
            if (candidate) await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
          }
        } catch (err) {
          console.error('Error setting remote description from answer:', err);
        }
      }
    });

    // WebRTC ICE Candidate received
    socket.on('webrtc:ice', async ({ candidate }) => {
      if (peerConnection.current && peerConnection.current.remoteDescription) {
        try {
          await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('Error adding ICE candidate:', err);
        }
      } else {
        pendingCandidates.current.push(candidate);
      }
    });

    return () => {
      socket.off('call:incoming');
      socket.off('call:accepted');
      socket.off('call:rejected');
      socket.off('call:ended');
      socket.off('webrtc:offer');
      socket.off('webrtc:answer');
      socket.off('webrtc:ice');
    };
  }, [socket, localStream]);

  // Start Call
  const startCall = async (targetUserId?: string, isVideo = true, conversationId?: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideo ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      });

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

      setLocalStream(stream);
      setActiveCall(incomingCall);
      targetUserRef.current = incomingCall.callerId;

      const pc = getOrCreatePeerConnection(incomingCall.callerId);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

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
        reason: 'Call declined by user',
      });
      setIncomingCall(null);
    }
  };

  // End active call
  const endCall = () => {
    if (activeCall) {
      socket?.emit('call:end', {
        targetUserId: targetUserRef.current,
        conversationId: activeCall.conversationId,
      });
    }
    cleanupCall();
  };

  // Toggle Mute Audio
  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
      }
    }
  };

  // Toggle Camera
  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
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
          if (localStream) {
            const originalVideoTrack = localStream.getVideoTracks()[0];
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
      if (localStream) {
        const videoSender = peerConnection.current
          .getSenders()
          .find((s) => s.track && s.track.kind === 'video');
        const originalVideoTrack = localStream.getVideoTracks()[0];
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
