import { useCallback, useEffect, useState } from 'react';
import { buildSnapRound, type SnapRound } from '../data/gameContent';
import { useGameSounds } from '../hooks/useGameSounds';
import { ui } from '../i18n/strings';
import { unlockAudio } from '../utils/audioUnlock';
import { GameShell } from './GameShell';

const TOTAL = 12;

type Props = {
  onBack: () => void;
  speakChar: (char: string) => void;
  onStar: () => void;
};

export function SnapMatchGame({ onBack, speakChar, onStar }: Props) {
  const sounds = useGameSounds();
  const [round, setRound] = useState<SnapRound>(() => buildSnapRound());
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [streak, setStreak] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [cardAnim, setCardAnim] = useState<'in' | 'out-left' | 'out-right'>('in');

  const loadRound = useCallback(
    (r: SnapRound) => {
      setRound(r);
      speakChar(r.speakHanzi);
      setCardAnim('in');
    },
    [speakChar]
  );

  useEffect(() => {
    void unlockAudio();
    speakChar(round.speakHanzi);
  }, []);

  const answer = (userSaysMatch: boolean) => {
    void unlockAudio();
    const ok = userSaysMatch === round.isMatch;
    setCardAnim(userSaysMatch ? 'out-right' : 'out-left');

    if (ok) {
      setStreak((s) => s + 1);
      sounds.match();
      setFeedback(ui.snapCorrect);
    } else {
      setStreak(0);
      sounds.wrong();
      setFeedback(ui.snapWrong);
    }

    window.setTimeout(() => {
      setFeedback(null);
      const nextIndex = index + 1;
      const newCorrect = correct + (ok ? 1 : 0);
      if (nextIndex >= TOTAL) {
        setCorrect(newCorrect);
        if (newCorrect >= 8) onStar();
        sounds.win();
        setIndex(TOTAL);
        return;
      }
      setCorrect(newCorrect);
      setIndex(nextIndex);
      loadRound(buildSnapRound());
    }, 500);
  };

  const restart = () => {
    setIndex(0);
    setCorrect(0);
    setStreak(0);
    loadRound(buildSnapRound());
  };

  const done = index >= TOTAL;

  const hud = (
    <>
      <span>{ui.roundOf(index + (done ? 0 : 1), TOTAL)}</span>
      <span>{ui.snapScore(correct)}</span>
      <span>{ui.streak(streak)}</span>
    </>
  );

  return (
    <GameShell title={ui.snapTitle} subtitle={ui.snapSub} onBack={onBack} hud={hud}>
      {done ? (
        <div className="game-end-card">
          <p>{ui.snapDone(correct, TOTAL)}</p>
          <button type="button" className="primary-btn" onClick={restart}>{ui.playAgain}</button>
        </div>
      ) : (
        <>
          <div className={`snap-card ${cardAnim}`}>
            <div className="snap-side">
              <small>Hanzi</small>
              <span>{round.hanzi}</span>
            </div>
            <div className="snap-divider" />
            <div className="snap-side">
              <small>Pinyin</small>
              <span className="snap-pinyin">{round.pinyin}</span>
            </div>
          </div>
          <button type="button" className="hear-btn snap-hear" onClick={() => speakChar(round.speakHanzi)}>
            {ui.playSound}
          </button>
          {feedback && <p className="snap-feedback">{feedback}</p>}
          <div className="snap-actions">
            <button type="button" className="snap-btn no" onClick={() => answer(false)}>
              {ui.snapNo}
            </button>
            <button type="button" className="snap-btn yes" onClick={() => answer(true)}>
              {ui.snapYes}
            </button>
          </div>
        </>
      )}
    </GameShell>
  );
}
