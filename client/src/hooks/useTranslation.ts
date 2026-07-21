import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../types';

export function useTranslation(
  messages: ChatMessage[],
  selfId: string,
  enabled: boolean,
  targetLang: string
) {
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translating, setTranslating] = useState(false);
  const pendingRef = useRef<Set<string>>(new Set());

  const translateMessages = useCallback(
    async (msgs: ChatMessage[]) => {
      const need = msgs.filter(
        (m) =>
          m.type === 'text' &&
          m.content?.trim() &&
          m.senderId !== selfId &&
          m.senderId !== 'system' &&
          !pendingRef.current.has(m.id)
      );
      if (!need.length) return;

      need.forEach((m) => pendingRef.current.add(m.id));
      setTranslating(true);
      try {
        const res = await fetch('/api/translate/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetLang,
            items: need.map((m) => ({ id: m.id, text: m.content })),
          }),
        });
        const data = await res.json();
        if (res.ok && data.translations) {
          setTranslations((prev) => ({ ...prev, ...data.translations }));
        }
      } catch {
        /* ignore */
      } finally {
        need.forEach((m) => pendingRef.current.delete(m.id));
        setTranslating(false);
      }
    },
    [selfId, targetLang]
  );

  useEffect(() => {
    setTranslations({});
    pendingRef.current.clear();
    if (!enabled) return;
    translateMessages(messages);
  }, [messages, enabled, targetLang, translateMessages]);

  return { translations, translating };
}
