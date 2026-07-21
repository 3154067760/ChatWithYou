import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { CallOverlay } from './components/CallOverlay';
import { MessageBubble } from './components/MessageBubble';
import { useChat, useWebRTC } from './hooks/useChat';
import { useTranslation } from './hooks/useTranslation';
import { LocaleToggle, useI18n } from './i18n';
import { LANGUAGES } from './languages';
import {
  downloadExport,
  getOrCreateVisitorId,
  getStoredAutoTranslate,
  getStoredLanguage,
  getStoredVisitorName,
  setStoredAutoTranslate,
  setStoredLanguage,
  setStoredVisitorName,
} from './utils';

type View = 'home' | 'room';

function getRoomFromUrl(): string {
  const params = new URLSearchParams(window.location.search);
  return (params.get('room') || '').trim();
}

export default function App() {
  const { t, locale } = useI18n();
  const [view, setView] = useState<View>('home');
  const [roomId, setRoomId] = useState('');
  const [joinInput, setJoinInput] = useState(getRoomFromUrl());
  const [displayName, setDisplayName] = useState(getStoredVisitorName());
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [myLang, setMyLang] = useState(getStoredLanguage);
  const [autoTranslate, setAutoTranslate] = useState(getStoredAutoTranslate);
  const [toolsOpen, setToolsOpen] = useState(false);

  const senderId = useMemo(() => getOrCreateVisitorId(), []);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const inRoom = view === 'room' && !!roomId;
  const name = displayName.trim() || t('defaultName');

  const { messages, connected, peerOnline, error, sendText, uploadFile, socketRef } = useChat({
    roomId,
    senderId,
    senderName: name,
    enabled: inRoom,
  });

  const webrtc = useWebRTC(socketRef, senderId, inRoom);

  const { translations, translating } = useTranslation(
    messages,
    senderId,
    autoTranslate,
    myLang
  );

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const qRoom = getRoomFromUrl();
    if (qRoom) setJoinInput(qRoom);
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const enterRoom = async (id: string) => {
    const rid = id.trim();
    if (!rid) return;
    if (!displayName.trim()) {
      showToast(t('enterNicknameFirst'));
      return;
    }
    const check = await fetch(`/api/rooms/${rid}/messages`);
    if (!check.ok) {
      showToast(t('roomNotFound'));
      return;
    }
    setStoredVisitorName(displayName.trim());
    setRoomId(rid);
    setView('room');
    const url = new URL(window.location.href);
    url.searchParams.set('room', rid);
    window.history.replaceState({}, '', url);
  };

  const createRoom = async () => {
    if (!displayName.trim()) {
      showToast(t('enterNicknameFirst'));
      return;
    }
    const res = await fetch('/api/rooms', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      showToast(t('createRoomFailed'));
      return;
    }
    enterRoom(data.roomId);
  };

  const copyLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    await navigator.clipboard.writeText(url);
    showToast(t('inviteCopied'));
  };

  const onSend = (e: FormEvent) => {
    e.preventDefault();
    const v = text.trim();
    if (!v) return;
    sendText(v);
    setText('');
  };

  const onPickFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadFile(file);
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('uploadFailed'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const onExport = async (format: 'json' | 'txt') => {
    try {
      await downloadExport(roomId, format);
    } catch {
      showToast(t('exportFailed'));
    }
  };

  const callBusy = webrtc.callState !== 'idle';
  const langLabel = LANGUAGES.find((l) => l.code === myLang)?.label ?? myLang;
  const statusError = error === '连接错误' ? t('connectionError') : error;

  if (view === 'home') {
    return (
      <div className="app home">
        <LocaleToggle className="locale-toggle-fixed" />
        <header className="hero">
          <h1>ChatWithYou</h1>
          <p>{t('appTagline')}</p>
        </header>

        <div className="card">
          <label>
            {t('yourNickname')}
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t('nicknamePlaceholder')}
              maxLength={20}
            />
          </label>

          <button type="button" className="primary" onClick={createRoom}>
            {t('createRoom')}
          </button>

          <div className="divider">{t('orJoinRoom')}</div>

          <label>
            {t('roomId')}
            <input
              value={joinInput}
              onChange={(e) => setJoinInput(e.target.value)}
              placeholder={t('roomIdPlaceholder')}
            />
          </label>
          <button type="button" onClick={() => enterRoom(joinInput)}>
            {t('enterRoom')}
          </button>
        </div>

        {toast && <div className="toast">{toast}</div>}
      </div>
    );
  }

  return (
    <div className="app chat-app">
      <header className="chat-header">
        <div className="chat-header-top">
          <div className="chat-header-info">
            <h1>{t('roomTitle', { id: roomId })}</h1>
            <p className="status">
              {connected
                ? peerOnline
                  ? t('peerOnline')
                  : t('waitingPeer')
                : t('connecting')}
              {statusError ? ` · ${statusError}` : ''}
              {autoTranslate && !toolsOpen
                ? ` · ${t('translatePrefix')}:${langLabel}`
                : ''}
            </p>
          </div>
          <div className="chat-header-actions">
            <LocaleToggle />
            <button
              type="button"
              className="tools-toggle"
              onClick={() => setToolsOpen((v) => !v)}
              aria-expanded={toolsOpen}
            >
              {toolsOpen ? t('collapseTools') : t('expandTools')}
            </button>
          </div>
        </div>
        <div className={`header-actions ${toolsOpen ? 'open' : ''}`}>
          <div className="header-actions-inner">
            <label className="translate-toggle">
              <input
                type="checkbox"
                checked={autoTranslate}
                onChange={(e) => {
                  setAutoTranslate(e.target.checked);
                  setStoredAutoTranslate(e.target.checked);
                }}
              />
              {t('autoTranslate')}
            </label>
            <select
              className="lang-select"
              value={myLang}
              onChange={(e) => {
                setMyLang(e.target.value);
                setStoredLanguage(e.target.value);
              }}
              disabled={!autoTranslate}
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
            {translating && <span className="translating-hint">{t('translating')}</span>}
            <button
              type="button"
              disabled={callBusy}
              onClick={() => webrtc.startCall('audio').catch(() => showToast(t('micDenied')))}
            >
              {t('voiceCall')}
            </button>
            <button
              type="button"
              disabled={callBusy}
              onClick={() =>
                webrtc.startCall('video').catch(() => showToast(t('cameraDenied')))
              }
            >
              {t('videoCall')}
            </button>
            <button type="button" onClick={copyLink}>
              {t('copyInvite')}
            </button>
            <button type="button" onClick={() => onExport('txt')}>
              {t('exportTxt')}
            </button>
            <button type="button" onClick={() => onExport('json')}>
              {t('exportJson')}
            </button>
            <button type="button" className="ghost" onClick={() => setView('home')}>
              {t('leave')}
            </button>
          </div>
        </div>
      </header>

      <main className="chat-main">
        <div className="message-list" ref={listRef}>
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              selfId={senderId}
              translation={translations[m.id]}
              showTranslation={autoTranslate}
              locale={locale}
            />
          ))}
        </div>

        <footer className="composer">
          <form className="input-row" onSubmit={onSend}>
            <input
              ref={fileRef}
              type="file"
              hidden
              onChange={(e) => onPickFile(e.target.files)}
            />
            <button
              type="button"
              className="attach"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? t('uploading') : '📎'}
            </button>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('messagePlaceholder')}
            />
            <button type="submit" className="primary">
              {t('send')}
            </button>
          </form>
        </footer>
      </main>

      {webrtc.callState === 'incoming' && webrtc.incomingCall && (
        <div className="incoming-modal">
          <p>
            {t('inviteCall', {
              name: webrtc.incomingCall.fromName,
              kind:
                webrtc.incomingCall.callType === 'video'
                  ? t('callKindVideo')
                  : t('callKindAudio'),
            })}
          </p>
          <div>
            <button type="button" className="primary" onClick={() => webrtc.acceptCall()}>
              {t('accept')}
            </button>
            <button type="button" className="danger" onClick={webrtc.rejectCall}>
              {t('reject')}
            </button>
          </div>
        </div>
      )}

      {(webrtc.callState === 'calling' || webrtc.callState === 'active') && (
        <CallOverlay
          localStream={webrtc.localStream}
          remoteStream={webrtc.remoteStream}
          callType={webrtc.activeCallType}
          mediaConnected={webrtc.mediaConnected}
          muted={webrtc.muted}
          videoOff={webrtc.videoOff}
          onHangUp={webrtc.hangUp}
          onToggleMute={webrtc.toggleMute}
          onToggleVideo={webrtc.toggleVideo}
        />
      )}

      {webrtc.callState === 'calling' && (
        <div className="calling-banner">{t('calling')}</div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
