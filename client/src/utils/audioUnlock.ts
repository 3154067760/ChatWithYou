/** Browsers block audio until a user gesture — call this on every tap/click. */
let sharedCtx: AudioContext | null = null;

export function getSharedAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!sharedCtx) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    sharedCtx = new Ctx();
  }
  return sharedCtx;
}

export async function unlockAudio(): Promise<void> {
  const ctx = getSharedAudioContext();
  if (ctx?.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      /* ignore */
    }
  }
  try {
    window.speechSynthesis?.resume();
  } catch {
    /* ignore */
  }
}
