import { useCallback, useRef, useSyncExternalStore } from 'react';
import { getGameSoundOn, setGameSoundOn } from '../utils/gameSettings';
import { getSharedAudioContext, unlockAudio } from '../utils/audioUnlock';

function subscribeSound(cb: () => void) {
  window.addEventListener('pinyin-sound-change', cb);
  return () => window.removeEventListener('pinyin-sound-change', cb);
}

export function toggleGameSound() {
  setGameSoundOn(!getGameSoundOn());
  window.dispatchEvent(new Event('pinyin-sound-change'));
}

export function useGameSoundOn() {
  return useSyncExternalStore(subscribeSound, getGameSoundOn, () => true);
}

/** Lightweight beeps — no audio files needed */
export function useGameSounds() {
  const soundOn = useGameSoundOn();
  const unlocked = useRef(false);

  const tone = useCallback(
    async (freq: number, duration = 0.12, volume = 0.14) => {
      if (!soundOn || typeof window === 'undefined') return;
      try {
        if (!unlocked.current) {
          await unlockAudio();
          unlocked.current = true;
        }
        const ctx = getSharedAudioContext();
        if (!ctx) return;
        if (ctx.state === 'suspended') await ctx.resume();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.value = volume;
        osc.connect(gain);
        gain.connect(ctx.destination);
        const t0 = ctx.currentTime;
        osc.start(t0);
        osc.stop(t0 + duration);
      } catch {
        /* ignore */
      }
    },
    [soundOn]
  );

  const match = useCallback(() => void tone(640, 0.1), [tone]);
  const wrong = useCallback(() => void tone(180, 0.18, 0.12), [tone]);
  const swap = useCallback(() => void tone(420, 0.06, 0.08), [tone]);
  const win = useCallback(() => {
    void tone(523, 0.12);
    window.setTimeout(() => void tone(659, 0.14), 110);
    window.setTimeout(() => void tone(784, 0.16), 220);
  }, [tone]);
  const combo = useCallback((streak: number) => void tone(480 + Math.min(streak, 8) * 35, 0.1), [tone]);
  const tick = useCallback(() => void tone(300, 0.05, 0.06), [tone]);

  const preview = useCallback(() => void tone(600, 0.15, 0.15), [tone]);

  return { match, wrong, win, swap, combo, tick, preview };
}
