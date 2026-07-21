import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { CallType, ChatMessage, WebRTCSignalPayload } from '../types';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

interface UseChatOptions {
  roomId: string;
  senderId: string;
  senderName: string;
  enabled: boolean;
}

export function useChat({ roomId, senderId, senderName, enabled }: UseChatOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [peerOnline, setPeerOnline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !roomId) return;

    let cancelled = false;

    (async () => {
      try {
        const histRes = await fetch(`/api/rooms/${roomId}/messages`);
        if (histRes.ok) {
          const hist = (await histRes.json()) as ChatMessage[];
          if (!cancelled) setMessages(hist);
        }
      } catch {
        /* ignore */
      }
    })();

    const socket = io({ path: '/socket.io', transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join', { roomId, senderId, senderName });
    });

    socket.on('disconnect', () => {
      setConnected(false);
      setPeerOnline(false);
    });

    socket.on('error', (payload: { message?: string }) => {
      setError(payload.message || '连接错误');
    });

    socket.on('joined', () => setError(null));

    socket.on('message', (msg: ChatMessage) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    socket.on('peer-joined', ({ senderId: peerId }: { senderId: string }) => {
      if (peerId !== senderId) setPeerOnline(true);
    });

    socket.on('peer-left', ({ senderId: peerId }: { senderId: string }) => {
      if (peerId !== senderId) setPeerOnline(false);
    });

    socket.on('peer-present', () => {
      setPeerOnline(true);
    });

    return () => {
      cancelled = true;
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled, roomId, senderId, senderName]);

  const sendText = useCallback((content: string) => {
    socketRef.current?.emit('send-message', { content });
  }, []);

  const uploadFile = useCallback(
    async (file: File) => {
      const form = new FormData();
      // 文本字段必须在 file 之前，否则 multer 处理文件时 roomId 还未解析
      form.append('roomId', roomId);
      form.append('senderId', senderId);
      form.append('senderName', senderName);
      form.append('file', file);

      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '上传失败');
      return data as ChatMessage;
    },
    [roomId, senderId, senderName]
  );

  return { messages, connected, peerOnline, error, sendText, uploadFile, socketRef };
}

export function useWebRTC(
  socketRef: React.RefObject<Socket | null>,
  selfId: string,
  enabled: boolean
) {
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  const pendingOfferRef = useRef<(RTCSessionDescriptionInit & { callType?: CallType }) | null>(
    null
  );

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [callState, setCallState] = useState<
    'idle' | 'calling' | 'incoming' | 'active'
  >('idle');
  const [incomingCall, setIncomingCall] = useState<{
    from: string;
    fromName: string;
    callType: CallType;
  } | null>(null);
  const [activeCallType, setActiveCallType] = useState<CallType>('audio');
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);

  const cleanupCall = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    pendingOfferRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setCallState('idle');
    setIncomingCall(null);
    setMuted(false);
    setVideoOff(false);
    pendingCandidates.current = [];
  }, []);

  const createPeerConnection = useCallback(() => {
    if (pcRef.current) return pcRef.current;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.ontrack = (ev) => {
      const stream = ev.streams[0] ?? new MediaStream([ev.track]);
      setRemoteStream(stream);
    };
    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        socketRef.current?.emit('webrtc-signal', {
          type: 'ice',
          candidate: ev.candidate.toJSON(),
        });
      }
    };
    pcRef.current = pc;
    return pc;
  }, [socketRef]);

  const attachLocalTracks = useCallback(
    async (callType: CallType, pc: RTCPeerConnection) => {
      if (localStreamRef.current) return localStreamRef.current;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === 'video',
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      return stream;
    },
    []
  );

  const flushCandidates = useCallback(async (pc: RTCPeerConnection) => {
    for (const c of pendingCandidates.current) {
      try {
        await pc.addIceCandidate(c);
      } catch {
        /* ignore stale */
      }
    }
    pendingCandidates.current = [];
  }, []);

  const startCall = useCallback(
    async (callType: CallType) => {
      if (!enabled || callState !== 'idle') return;
      try {
        setActiveCallType(callType);
        setCallState('calling');
        const pc = createPeerConnection();
        await attachLocalTracks(callType, pc);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socketRef.current?.emit('call-event', { event: 'start', callType });
        socketRef.current?.emit('webrtc-signal', { type: 'offer', sdp: offer, callType });
      } catch (e) {
        cleanupCall();
        throw e;
      }
    },
    [attachLocalTracks, callState, cleanupCall, createPeerConnection, enabled, socketRef]
  );

  const acceptCall = useCallback(async () => {
    const offer = pendingOfferRef.current;
    if (!offer || !incomingCall) return;
    const callType = incomingCall.callType;
    try {
      setActiveCallType(callType);
      setCallState('active');
      setIncomingCall(null);

      const pc = createPeerConnection();
      await pc.setRemoteDescription(offer);
      await attachLocalTracks(callType, pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socketRef.current?.emit('webrtc-signal', { type: 'answer', sdp: answer });
      socketRef.current?.emit('call-event', { event: 'accept', callType });
      await flushCandidates(pc);
      pendingOfferRef.current = null;
    } catch (e) {
      cleanupCall();
      throw e;
    }
  }, [attachLocalTracks, cleanupCall, createPeerConnection, flushCandidates, incomingCall, socketRef]);

  const rejectCall = useCallback(() => {
    socketRef.current?.emit('call-event', { event: 'reject' });
    pendingOfferRef.current = null;
    setIncomingCall(null);
    setCallState('idle');
  }, [socketRef]);

  const hangUp = useCallback(() => {
    socketRef.current?.emit('call-event', { event: 'end' });
    cleanupCall();
  }, [cleanupCall, socketRef]);

  const toggleMute = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
  }, []);

  const toggleVideo = useCallback(() => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setVideoOff(!track.enabled);
  }, []);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !enabled) return;

    const onSignal = async (payload: WebRTCSignalPayload & { callType?: CallType }) => {
      if (payload.from === selfId) return;

      if (payload.type === 'offer' && payload.sdp) {
        pendingOfferRef.current = { ...payload.sdp, callType: payload.callType };
        pendingCandidates.current = [];
        setIncomingCall({
          from: payload.from || '',
          fromName: payload.fromName || '对方',
          callType: payload.callType || 'audio',
        });
        setCallState('incoming');
        return;
      }

      if (payload.type === 'answer' && payload.sdp && pcRef.current) {
        await pcRef.current.setRemoteDescription(payload.sdp);
        setCallState('active');
        await flushCandidates(pcRef.current);
        return;
      }

      if (payload.type === 'ice' && payload.candidate) {
        if (pcRef.current?.remoteDescription) {
          try {
            await pcRef.current.addIceCandidate(payload.candidate);
          } catch {
            /* ignore */
          }
        } else {
          pendingCandidates.current.push(payload.candidate);
        }
      }
    };

    const onCallEvent = (payload: { event: string; from?: string }) => {
      if (payload.from === selfId) return;
      if (payload.event === 'end' || payload.event === 'reject') {
        cleanupCall();
      }
    };

    socket.on('webrtc-signal', onSignal);
    socket.on('call-event', onCallEvent);
    return () => {
      socket.off('webrtc-signal', onSignal);
      socket.off('call-event', onCallEvent);
    };
  }, [cleanupCall, enabled, flushCandidates, selfId, socketRef]);

  useEffect(() => () => cleanupCall(), [cleanupCall]);

  return {
    localStream,
    remoteStream,
    callState,
    incomingCall,
    activeCallType,
    muted,
    videoOff,
    startCall,
    acceptCall,
    rejectCall,
    hangUp,
    toggleMute,
    toggleVideo,
  };
}
