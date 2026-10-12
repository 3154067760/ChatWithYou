import { useCallback, useRef } from 'react';
import type { PinyinItem } from '../data/pinyin';
import { quizCharAudio } from '../data/pinyin';
import type { StoryLine } from '../data/stories';
import { unlockAudio } from '../utils/audioUnlock';

export function useSpeech() {
  const current = useRef<HTMLAudioElement | null>(null);
  const playingAll = useRef(false);

  const stopAudio = useCallback(() => {
    window.speechSynthesis?.cancel();
    if (current.current) {
      current.current.pause();
      current.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    playingAll.current = false;
    stopAudio();
  }, [stopAudio]);

  const speakText = useCallback((text: string) => {
    if (!text || typeof window === 'undefined') return;
    void unlockAudio();
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN';
    u.rate = 0.85;
    synth.speak(u);
  }, []);

  const playUrlAsync = useCallback(
    (url: string, fallbackText: string): Promise<void> =>
      new Promise((resolve) => {
        void unlockAudio().then(() => {
          stopAudio();
          const audio = new Audio(url);
          current.current = audio;
          const finish = () => resolve();
          audio.onended = finish;
          audio.onerror = () => {
            speakText(fallbackText);
            window.setTimeout(finish, 1600);
          };
          void audio.play().catch(() => {
            speakText(fallbackText);
            window.setTimeout(finish, 1600);
          });
        });
      }),
    [speakText, stopAudio]
  );

  const playUrl = useCallback(
    (url: string, fallbackText: string) => {
      playingAll.current = false;
      void playUrlAsync(url, fallbackText);
    },
    [playUrlAsync]
  );

  const speak = useCallback(
    (text: string, audioUrl?: string) => {
      if (audioUrl) {
        playUrl(audioUrl, text);
        return;
      }
      speakText(text);
    },
    [playUrl, speakText]
  );

  const speakPinyin = useCallback(
    (item: PinyinItem) => {
      speak(item.speak, item.audio);
    },
    [speak]
  );

  const speakChar = useCallback(
    (char: string) => {
      speak(char, quizCharAudio(char));
    },
    [speak]
  );

  const speakStoryLine = useCallback(
    (line: StoryLine) => {
      speak(line.speak, line.audio);
    },
    [speak]
  );

  const speakStoryAll = useCallback(
    async (lines: StoryLine[]) => {
      playingAll.current = true;
      for (const ln of lines) {
        if (!playingAll.current) break;
        await playUrlAsync(ln.audio, ln.speak);
        await new Promise((r) => setTimeout(r, 400));
      }
      playingAll.current = false;
    },
    [playUrlAsync]
  );

  return { speak, speakPinyin, speakChar, speakStoryLine, speakStoryAll, stop };
}
