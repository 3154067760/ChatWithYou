import { useCallback, useEffect, useState } from 'react';
import { buildBubbleRoundMixed } from '../data/gameContent';
import { useGameSounds } from '../hooks/useGameSounds';
import { ui } from '../i18n/strings';
import { unlockAudio } from '../utils/audioUnlock';
import { GameShell } from './GameShell';

const DURATION = 45;

type Props = {
  onBack: () => void;
  speakChar: (char: string) => void;
  onStar: () => void;
};

export function BubblePopGame({ onBack, speakChar, onStar }: Props) {
  const sounds = useGameSounds();
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [round, setRound] = useState(buildBubbleRoundMixed);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [running, setRunning] = useState(true);
  const [popId, setPopId] = useState<string | null>(null);
  const [flash, setFlash] = useState<'ok' | 'bad' | null>(null);

  const nextRound = useCallback(() => {
    const r = buildBubbleRoundMixed();
    setRound(r);
    setPopId(null);
    speakChar(r.target.hanzi);
  }, [speakChar]);

  useEffect(() => {
    void unlockAudio();
    speakChar(round.target.hanzi);
  }, []);

  useEffect(() => {
    if (!running) return;
    if (timeLeft <= 0) {
      setRunning(false);
      if (score >= 80) onStar();
      sounds.win();
      return;
    }
    const t = window.setInterval(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [running, timeLeft, score, onStar, sounds]);

  const onBubble = (pinyin: string) => {
    if (!running || popId) return;
    void unlockAudio();
    if (pinyin === round.target.pinyin) {
      const pts = 15 + streak * 5;
      setScore((s) => s + pts);
      setStreak((s) => s + 1);
      setPopId(pinyin);
      setFlash('ok');
      sounds.match();
      window.setTimeout(() => {
        setFlash(null);
        nextRound();
      }, 450);
    } else {
      setStreak(0);
      setFlash('bad');
      sounds.wrong();
      window.setTimeout(() => setFlash(null), 400);
    }
  };

  const restart = () => {
    setTimeLeft(DURATION);
    setScore(0);
    setStreak(0);
    setRunning(true);
    nextRound();
  };

  const hud = (
    <>
      <span className={timeLeft <= 8 ? 'time-warn' : ''}>{ui.timeLeft(timeLeft)}</span>
      <span>{ui.gameScore(score)}</span>
      <span className={streak >= 3 ? 'streak-hot' : ''}>{ui.streak(streak)}</span>
    </>
  );

  return (
    <GameShell title={ui.bubbleTitle} subtitle={ui.bubbleSub} onBack={onBack} hud={hud}>
      <div className={`bubble-stage ${flash ?? ''}`}>
        {!running ? (
          <div className="game-end-card">
            <p className="big-char">{round.target.hanzi}</p>
            <p>{ui.bubbleOver(score)}</p>
            <button type="button" className="primary-btn" onClick={restart}>{ui.playAgain}</button>
          </div>
        ) : (
          <>
            <div className="bubble-target">
              <span className="bubble-target-label">{ui.bubbleListen}</span>
              <span className="big-char">{round.target.hanzi}</span>
              <button type="button" className="hear-btn" onClick={() => speakChar(round.target.hanzi)}>
                {ui.playSound}
              </button>
            </div>
            <div className="bubble-field">
              {round.choices.map((py, i) => (
                <button
                  key={py}
                  type="button"
                  className={`bubble ${popId === py ? 'pop' : ''} bubble-${i}`}
                  onClick={() => onBubble(py)}
                >
                  {py}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </GameShell>
  );
}
