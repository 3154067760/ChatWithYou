import { useEffect, useRef } from 'react';
import { useI18n } from '../i18n';

function AudioPlayer({ stream }: { stream: MediaStream | null }) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const play = () => {
      el.srcObject = stream;
      el.volume = 1;
      el.muted = false;
      if (stream) {
        void el.play().catch(() => {});
      }
    };

    play();

    if (!stream) return;

    const onTrackChange = () => play();
    for (const track of stream.getAudioTracks()) {
      track.onunmute = onTrackChange;
      track.onended = onTrackChange;
    }
    stream.addEventListener('addtrack', onTrackChange);

    return () => {
      stream.removeEventListener('addtrack', onTrackChange);
    };
  }, [stream]);

  return <audio ref={audioRef} autoPlay playsInline className="remote-audio" />;
}

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
    if (!el) return;
    el.srcObject = stream;
    if (stream) {
      void el.play().catch(() => {});
    }
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
  mediaConnected: boolean;
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
  mediaConnected,
  muted,
  videoOff,
  onHangUp,
  onToggleMute,
  onToggleVideo,
}: Props) {
  const { t } = useI18n();

  return (
    <div className="call-overlay">
      <AudioPlayer stream={remoteStream} />
      <div className="call-body">
        {callType === 'video' ? (
          <div className="video-grid">
            <VideoPane stream={remoteStream} label={t('peer')} />
            <VideoPane stream={localStream} label={t('me')} mirrored />
          </div>
        ) : (
          <div className="audio-call">
            <div className="audio-avatar">🎙️</div>
            <p>{mediaConnected ? t('voiceActive') : t('voiceConnecting')}</p>
          </div>
        )}
      </div>
      <div className="call-controls">
        <button type="button" onClick={onToggleMute} className={muted ? 'active' : ''}>
          {muted ? t('unmute') : t('mute')}
        </button>
        {callType === 'video' && (
          <button type="button" onClick={onToggleVideo} className={videoOff ? 'active' : ''}>
            {videoOff ? t('turnOnCamera') : t('turnOffCamera')}
          </button>
        )}
        <button type="button" className="danger" onClick={onHangUp}>
          {t('hangUp')}
        </button>
      </div>
    </div>
  );
}
