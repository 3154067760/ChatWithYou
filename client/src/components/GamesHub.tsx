import { ui } from '../i18n/strings';
import { toggleGameSound, useGameSoundOn, useGameSounds } from '../hooks/useGameSounds';
import { unlockAudio } from '../utils/audioUnlock';

export type GameId = 'bubble' | 'snap' | 'climb';

type Props = {
  onBack: () => void;
  onPick: (id: GameId) => void;
};

export function GamesHub({ onBack, onPick }: Props) {
  const soundOn = useGameSoundOn();
  const sounds = useGameSounds();

  return (
    <div className="screen">
      <header className="sub-header">
        <button type="button" className="back" onClick={onBack}>{ui.back}</button>
        <h2>{ui.gamesTitle}</h2>
      </header>
      <p className="tip">{ui.gamesIntro}</p>
      <div className="sound-row">
        <button type="button" className="sound-toggle" onClick={toggleGameSound}>
          {soundOn ? ui.soundOn : ui.soundOff}
        </button>
        <button
          type="button"
          className="sound-toggle test-sound"
          onClick={() => {
            void unlockAudio();
            sounds.preview();
          }}
        >
          {ui.testSound}
        </button>
      </div>
      <div className="game-pick-grid">
        <button type="button" className="game-pick-card bubble" onClick={() => onPick('bubble')}>
          <span className="game-pick-icon">🫧</span>
          <strong>{ui.bubbleTitle}</strong>
          <small>{ui.bubbleSub}</small>
        </button>
        <button type="button" className="game-pick-card snap" onClick={() => onPick('snap')}>
          <span className="game-pick-icon">⚡</span>
          <strong>{ui.snapTitle}</strong>
          <small>{ui.snapSub}</small>
        </button>
        <button type="button" className="game-pick-card climb" onClick={() => onPick('climb')}>
          <span className="game-pick-icon">🧗</span>
          <strong>{ui.climbTitle}</strong>
          <small>{ui.climbSub}</small>
        </button>
      </div>
    </div>
  );
}
