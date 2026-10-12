import { WORD_PAIRS, type WordPair } from './gamePairs';
import { SYLLABLE_QUIZ, TONE_QUIZ, pickRandom, shuffle } from './pinyin';

export type SnapRound = {
  hanzi: string;
  pinyin: string;
  isMatch: boolean;
  speakHanzi: string;
};

export function buildSnapRound(): SnapRound {
  const correct = pickRandom(WORD_PAIRS);
  const isMatch = Math.random() < 0.55;
  if (isMatch) {
    return {
      hanzi: correct.hanzi,
      pinyin: correct.pinyin,
      isMatch: true,
      speakHanzi: correct.hanzi,
    };
  }
  const other = pickRandom(WORD_PAIRS.filter((p) => p.id !== correct.id));
  return {
    hanzi: correct.hanzi,
    pinyin: other.pinyin,
    isMatch: false,
    speakHanzi: correct.hanzi,
  };
}

export type BubbleRound = {
  target: WordPair;
  choices: string[];
};

export function buildBubbleRound(): BubbleRound {
  const target = pickRandom(WORD_PAIRS);
  const wrong = shuffle(WORD_PAIRS.filter((p) => p.id !== target.id))
    .slice(0, 3)
    .map((p) => p.pinyin);
  return {
    target,
    choices: shuffle([target.pinyin, ...wrong]),
  };
}

export function buildBubbleRoundFromQuiz(): BubbleRound {
  const q = pickRandom(SYLLABLE_QUIZ);
  const wrong = q.wrong.slice(0, 3);
  return {
    target: { id: q.pinyin, hanzi: q.char, pinyin: q.pinyin },
    choices: shuffle([q.pinyin, ...wrong]),
  };
}

export { TONE_QUIZ, pickRandom };
