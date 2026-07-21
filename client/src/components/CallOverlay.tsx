import { useEffect, useRef } from 'react';

function VideoPane({
  stream,
  label,
  mirrored,
}: {
  stream: MediaStream | null;
  label: string;
  mirrored?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (el) el.srcObject = stream;
  }, [stream]);

  return (
    <div className="video-pane">
      <video ref={videoRef} autoPlay playsInline muted={mirrored} className={mirrored ? 'mirror' : ''} />
      {!stream && <div className="video-placeholder">{label}</div>}
      <span className="video-label">{label}</span>
    </div>
  );
}

interface Props {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  callType: 'audio' | 'video';
  muted: boolean;
  videoOff: boolean;
  onHangUp: () => void;
  onToggleMute: () => void;
  onToggleVideo: () => void;
}

export function CallOverlay({
  localStream,
  remoteStream,
  callType,
  muted,
  videoOff,
  onHangUp,
  onToggleMute,
  onToggleVideo,
}: Props) {
  return (
    <div className="call-overlay">
      <div className="call-body">
        {callType === 'video' ? (
          <div className="video-grid">
            <VideoPane stream={remoteStream} label="对方" />
            <VideoPane stream={localStream} label="我" mirrored />
          </div>
        ) : (
          <div className="audio-call">
            <div className="audio-avatar">🎙️</div>
            <p>语音通话中</p>
          </div>
        )}
      </div>
      <div className="call-controls">
        <button type="button" onClick={onToggleMute} className={muted ? 'active' : ''}>
          {muted ? '取消静音' : '静音'}
        </button>
        {callType === 'video' && (
          <button type="button" onClick={onToggleVideo} className={videoOff ? 'active' : ''}>
            {videoOff ? '开启摄像头' : '关闭摄像头'}
          </button>
        )}
        <button type="button" className="danger" onClick={onHangUp}>
          挂断
        </button>
      </div>
    </div>
  );
}
