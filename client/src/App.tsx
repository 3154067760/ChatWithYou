import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { CallOverlay } from './components/CallOverlay';
import { MessageBubble } from './components/MessageBubble';
import { useChat, useWebRTC } from './hooks/useChat';
import { useTranslation } from './hooks/useTranslation';
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
  const name = displayName.trim() || '访客';

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
      showToast('请先填写昵称');
      return;
    }
    const check = await fetch(`/api/rooms/${rid}/messages`);
    if (!check.ok) {
      showToast('房间不存在，请确认房间号或让好友先创建房间');
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
      showToast('请先填写昵称');
      return;
    }
    const res = await fetch('/api/rooms', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      showToast('创建房间失败');
      return;
    }
    enterRoom(data.roomId);
  };

  const copyLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    await navigator.clipboard.writeText(url);
    showToast('邀请链接已复制');
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
      showToast(err instanceof Error ? err.message : '上传失败');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const onExport = async (format: 'json' | 'txt') => {
    try {
      await downloadExport(roomId, format);
    } catch {
      showToast('导出失败');
    }
  };

  const callBusy = webrtc.callState !== 'idle';

  if (view === 'home') {
    return (
      <div className="app home">
        <header className="hero">
          <h1>ChatWithYou</h1>
          <p>1v1 文字 · 语音 · 视频 · 图片/文件 · 自动翻译 · 导出聊天记录</p>
        </header>

        <div className="card">
          <label>
            你的昵称
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="例如：小明"
              maxLength={20}
            />
          </label>

          <button type="button" className="primary" onClick={createRoom}>
            创建房间
          </button>

          <div className="divider">或加入已有房间</div>

          <label>
            房间号
            <input
              value={joinInput}
              onChange={(e) => setJoinInput(e.target.value)}
              placeholder="8 位房间号"
            />
          </label>
          <button type="button" onClick={() => enterRoom(joinInput)}>
            进入房间
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
            <h1>房间 {roomId}</h1>
            <p className="status">
              {connected ? (peerOnline ? '对方在线' : '等待对方加入…') : '连接中…'}
              {error ? ` · ${error}` : ''}
              {autoTranslate && !toolsOpen ? ` · 翻译:${LANGUAGES.find((l) => l.code === myLang)?.label}` : ''}
            </p>
          </div>
          <button
            type="button"
            className="tools-toggle"
            onClick={() => setToolsOpen((v) => !v)}
            aria-expanded={toolsOpen}
          >
            {toolsOpen ? '收起 ▲' : '功能 ▼'}
          </button>
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
              自动翻译
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
            {translating && <span className="translating-hint">翻译中…</span>}
            <button
              type="button"
              disabled={callBusy}
              onClick={() => webrtc.startCall('audio').catch(() => showToast('无法访问麦克风'))}
            >
              语音通话
            </button>
            <button
              type="button"
              disabled={callBusy}
              onClick={() =>
                webrtc.startCall('video').catch(() => showToast('无法访问摄像头/麦克风'))
              }
            >
              视频通话
            </button>
            <button type="button" onClick={copyLink}>
              复制邀请链接
            </button>
            <button type="button" onClick={() => onExport('txt')}>
              导出 TXT
            </button>
            <button type="button" onClick={() => onExport('json')}>
              导出 JSON
            </button>
            <button type="button" className="ghost" onClick={() => setView('home')}>
              离开
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
              {uploading ? '上传中…' : '📎'}
            </button>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="输入消息…"
            />
            <button type="submit" className="primary">
              发送
            </button>
          </form>
        </footer>
      </main>

      {webrtc.callState === 'incoming' && webrtc.incomingCall && (
        <div className="incoming-modal">
          <p>
            {webrtc.incomingCall.fromName} 邀请
            {webrtc.incomingCall.callType === 'video' ? '视频' : '语音'}通话
          </p>
          <div>
            <button type="button" className="primary" onClick={() => webrtc.acceptCall()}>
              接听
            </button>
            <button type="button" className="danger" onClick={webrtc.rejectCall}>
              拒绝
            </button>
          </div>
        </div>
      )}

      {(webrtc.callState === 'calling' || webrtc.callState === 'active') && (
        <CallOverlay
          localStream={webrtc.localStream}
          remoteStream={webrtc.remoteStream}
          callType={webrtc.activeCallType}
          muted={webrtc.muted}
          videoOff={webrtc.videoOff}
          onHangUp={webrtc.hangUp}
          onToggleMute={webrtc.toggleMute}
          onToggleVideo={webrtc.toggleVideo}
        />
      )}

      {webrtc.callState === 'calling' && (
        <div className="calling-banner">正在呼叫对方…</div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
