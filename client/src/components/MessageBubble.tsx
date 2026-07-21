import type { UiLocale } from '../i18n';
import type { ChatMessage } from '../types';
import { formatFileSize, formatTime } from '../utils';

interface Props {
  message: ChatMessage;
  selfId: string;
  translation?: string;
  showTranslation?: boolean;
  locale: UiLocale;
}

export function MessageBubble({ message, selfId, translation, showTranslation, locale }: Props) {
  const isSelf = message.senderId === selfId;
  const isSystem = message.type === 'system';

  if (isSystem) {
    return (
      <div className="msg-system">
        <span>{message.content}</span>
      </div>
    );
  }

  const hasTranslation =
    showTranslation &&
    translation &&
    message.type === 'text' &&
    translation.trim() !== (message.content || '').trim();

  return (
    <div className={`msg-row ${isSelf ? 'self' : 'peer'}`}>
      <div className="msg-meta">
        {!isSelf && <span className="msg-name">{message.senderName}</span>}
        <span className="msg-time">{formatTime(message.createdAt, locale)}</span>
      </div>
      <div className={`msg-bubble ${isSelf ? 'self' : 'peer'}`}>
        {message.type === 'text' && (
          <>
            {hasTranslation ? (
              <>
                <p className="msg-translated">{translation}</p>
                <p className="msg-original">{message.content}</p>
              </>
            ) : (
              <p>{message.content}</p>
            )}
          </>
        )}
        {message.type === 'image' && message.fileUrl && (
          <a href={message.fileUrl} target="_blank" rel="noreferrer">
            <img src={message.fileUrl} alt={message.fileName} className="msg-image" />
          </a>
        )}
        {message.type === 'file' && message.fileUrl && (
          <a className="msg-file" href={message.fileUrl} download={message.fileName}>
            <span className="file-icon">📄</span>
            <span>
              <strong>{message.fileName}</strong>
              <small>{formatFileSize(message.fileSize)}</small>
            </span>
          </a>
        )}
      </div>
    </div>
  );
}
