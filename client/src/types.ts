export type MessageType = 'text' | 'image' | 'file' | 'system';

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  type: MessageType;
  content: string | null;
  createdAt: string;
  fileName?: string;
  fileSize?: number;
  fileMime?: string;
  fileUrl?: string;
}

export type CallType = 'audio' | 'video';

export interface WebRTCSignalPayload {
  type: 'offer' | 'answer' | 'ice';
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  from?: string;
  fromName?: string;
}
