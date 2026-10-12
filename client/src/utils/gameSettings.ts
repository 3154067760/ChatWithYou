const SOUND_KEY = 'pinyin_game_sound';

export function getGameSoundOn(): boolean {
  try {
    const v = localStorage.getItem(SOUND_KEY);
    return v === null ? true : v === '1';
  } catch {
    return true;
  }
}

export function setGameSoundOn(on: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}
