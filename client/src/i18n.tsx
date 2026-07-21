import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { getStoredUiLocale, setStoredUiLocale } from './utils';

export type UiLocale = 'zh' | 'en';

const zh = {
  appTagline: '1v1 文字 · 语音 · 视频 · 图片/文件 · 自动翻译 · 导出聊天记录',
  yourNickname: '你的昵称',
  nicknamePlaceholder: '例如：小明',
  createRoom: '创建房间',
  orJoinRoom: '或加入已有房间',
  roomId: '房间号',
  roomIdPlaceholder: '8 位房间号',
  enterRoom: '进入房间',
  defaultName: '访客',
  enterNicknameFirst: '请先填写昵称',
  roomNotFound: '房间不存在，请确认房间号或让好友先创建房间',
  createRoomFailed: '创建房间失败',
  inviteCopied: '邀请链接已复制',
  uploadFailed: '上传失败',
  exportFailed: '导出失败',
  micDenied: '无法访问麦克风',
  cameraDenied: '无法访问摄像头/麦克风',
  roomTitle: '房间 {id}',
  peerOnline: '对方在线',
  waitingPeer: '等待对方加入…',
  connecting: '连接中…',
  translatePrefix: '翻译',
  collapseTools: '收起 ▲',
  expandTools: '功能 ▼',
  autoTranslate: '自动翻译',
  translating: '翻译中…',
  voiceCall: '语音通话',
  videoCall: '视频通话',
  copyInvite: '复制邀请链接',
  exportTxt: '导出 TXT',
  exportJson: '导出 JSON',
  leave: '离开',
  uploading: '上传中…',
  messagePlaceholder: '输入消息…',
  send: '发送',
  inviteCall: '{name} 邀请{kind}通话',
  callKindVideo: '视频',
  callKindAudio: '语音',
  accept: '接听',
  reject: '拒绝',
  calling: '正在呼叫对方…',
  switchToEn: 'English',
  switchToZh: '中文',
  loadError: '页面加载出错',
  reload: '刷新重试',
  peer: '对方',
  me: '我',
  voiceActive: '语音通话中',
  voiceConnecting: '正在建立音频连接…',
  unmute: '取消静音',
  mute: '静音',
  turnOnCamera: '开启摄像头',
  turnOffCamera: '关闭摄像头',
  hangUp: '挂断',
  connectionError: '连接错误',
} as const;

const en: Record<keyof typeof zh, string> = {
  appTagline: '1v1 text · voice · video · files · auto-translate · export chat',
  yourNickname: 'Your nickname',
  nicknamePlaceholder: 'e.g. Alex',
  createRoom: 'Create room',
  orJoinRoom: 'Or join a room',
  roomId: 'Room ID',
  roomIdPlaceholder: '8-character room ID',
  enterRoom: 'Join room',
  defaultName: 'Guest',
  enterNicknameFirst: 'Please enter a nickname first',
  roomNotFound: 'Room not found. Check the ID or ask your friend to create one',
  createRoomFailed: 'Failed to create room',
  inviteCopied: 'Invite link copied',
  uploadFailed: 'Upload failed',
  exportFailed: 'Export failed',
  micDenied: 'Microphone access denied',
  cameraDenied: 'Camera/microphone access denied',
  roomTitle: 'Room {id}',
  peerOnline: 'Peer online',
  waitingPeer: 'Waiting for peer…',
  connecting: 'Connecting…',
  translatePrefix: 'Translate',
  collapseTools: 'Less ▲',
  expandTools: 'Tools ▼',
  autoTranslate: 'Auto-translate',
  translating: 'Translating…',
  voiceCall: 'Voice call',
  videoCall: 'Video call',
  copyInvite: 'Copy invite link',
  exportTxt: 'Export TXT',
  exportJson: 'Export JSON',
  leave: 'Leave',
  uploading: 'Uploading…',
  messagePlaceholder: 'Type a message…',
  send: 'Send',
  inviteCall: '{name} invites you to a {kind} call',
  callKindVideo: 'video',
  callKindAudio: 'voice',
  accept: 'Accept',
  reject: 'Decline',
  calling: 'Calling…',
  switchToEn: 'English',
  switchToZh: '中文',
  loadError: 'Failed to load page',
  reload: 'Reload',
  peer: 'Peer',
  me: 'Me',
  voiceActive: 'Voice call in progress',
  voiceConnecting: 'Connecting audio…',
  unmute: 'Unmute',
  mute: 'Mute',
  turnOnCamera: 'Turn camera on',
  turnOffCamera: 'Turn camera off',
  hangUp: 'Hang up',
  connectionError: 'Connection error',
};

const catalogs = { zh, en };

type I18nKey = keyof typeof zh;

type I18nContextValue = {
  locale: UiLocale;
  setLocale: (locale: UiLocale) => void;
  t: (key: I18nKey, vars?: Record<string, string>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function interpolate(text: string, vars?: Record<string, string>) {
  if (!vars) return text;
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replace(new RegExp(`\\{${k}\\}`, 'g'), v),
    text
  );
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<UiLocale>(getStoredUiLocale);

  const setLocale = useCallback((next: UiLocale) => {
    setLocaleState(next);
    setStoredUiLocale(next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
  }, [locale]);

  const t = useCallback(
    (key: I18nKey, vars?: Record<string, string>) =>
      interpolate(catalogs[locale][key], vars),
    [locale]
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

export function LocaleToggle({ className = '' }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <button
      type="button"
      className={`locale-toggle ${className}`.trim()}
      onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}
      aria-label={locale === 'zh' ? t('switchToEn') : t('switchToZh')}
    >
      {locale === 'zh' ? t('switchToEn') : t('switchToZh')}
    </button>
  );
}
