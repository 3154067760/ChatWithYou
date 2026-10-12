import { useEffect, useState } from 'react';
import { TONE_LABELS_EN, ui } from '../i18n/strings';
import { TONE_QUIZ, pickRandom, type Tone } from '../data/pinyin';
import { useGameSounds } from '../hooks/useGameSounds';
import { unlockAudio } from '../utils/audioUnlock';
import { GameShell } from './GameShell';

const GOAL = 8;

type Props = {
  onBack: () => void;
  speakChar: (char: string) => void;
  onStar: () => void;
};

export function ToneClimbGame({ onBack, speakChar, onStar }: Props) {
  const sounds = useGameSounds();
  const [q, setQ] = useState(() => pickRandom(TONE_QUIZ));
  const [step, setStep] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [won, setWon] = useState(false);

  useEffect(() => {
    void unlockAudio();
    speakChar(q.char);
  }, []);

  const pick = (tone: Tone) => {
    void unlockAudio();
    if (tone === q.tone) {
      const ns = step + 1;
      setStep(ns);
      sounds.match();
      setFeedback(ui.toneClimbOk);
      if (ns >= GOAL) {
        setWon(true);
        onStar();
        sounds.win();
      } else {
        window.setTimeout(() => {
          const nq = pickRandom(TONE_QUIZ);
          setQ(nq);
          setFeedback(null);
          speakChar(nq.char);
        }, 600);
      }
    } else {
      sounds.wrong();
      setFeedback(TONE_LABELS_EN[q.tone]);
      setStep((s) => Math.max(0, s - 1));
    }
  };

  const restart = () => {
    setStep(0);
    setWon(false);
    const nq = pickRandom(TONE_QUIZ);
    setQ(nq);
    setFeedback(null);
    speakChar(nq.char);
  };

  const hud = (
    <>
      <span>{ui.toneClimbProgress(step, GOAL)}</span>
    </>
  );

  return (
    <GameShell title={ui.climbTitle} subtitle={ui.climbSub} onBack={onBack} hud={hud}>
      {won ? (
        <div className="game-end-card">
          <p>{ui.climbWin}</p>
          <button type="button" className="primary-btn" onClick={restart}>{ui.playAgain}</button>
        </div>
      ) : (
        <>
          <div className="climb-visual">
            <div className="climb-mountain">
              {Array.from({ length: GOAL }, (_, i) => (
                <span
                  key={i}
                  className={`climb-step ${i < step ? 'on' : ''} ${i === step ? 'current' : ''}`}
                />
              ))}
              <span className="climb-avatar" style={{ bottom: `${12 + step * 9}%` }}>🧗</span>
            </div>
          </div>
          <div className="climb-question">
            <p>
              {ui.tonePrompt(q.char, q.base)}
            </p>
            <button type="button" className="hear-btn" onClick={() => speakChar(q.char)}>
              {ui.playSound}
            </button>
          </div>
          <div className="tone-pick-grid">
            {([1, 2, 3, 4] as Tone[]).map((t) => (
              <button key={t} type="button" className={`tone-pick tone-${t}`} onClick={() => pick(t)}>
                {TONE_LABELS_EN[t]}
              </button>
            ))}
          </div>
          {feedback && <p className="snap-feedback">{feedback}</p>}
        </>
      )}
    </GameShell>
  );
}
