import { uniqueWordPairs, type WordPair } from './gamePairs';
import { SYLLABLE_QUIZ, TONE_QUIZ, pickRandom, shuffle } from './pinyin';

const VOCAB: WordPair[] = uniqueWordPairs();

function randomPinyinDistractors(correct: string, count: number): string[] {
  const pool = shuffle(VOCAB.map((p) => p.pinyin).filter((py) => py !== correct));
  const fromQuiz = shuffle(SYLLABLE_QUIZ.map((q) => q.pinyin).filter((py) => py !== correct));
  const merged = shuffle([...pool, ...fromQuiz]);
  return merged.slice(0, count);
}

export type SnapRound = {
  hanzi: string;
  pinyin: string;
  isMatch: boolean;
  speakHanzi: string;
};

export function buildSnapRound(): SnapRound {
  const correct = pickRandom(VOCAB);
  const isMatch = Math.random() < 0.52;
  if (isMatch) {
    return {
      hanzi: correct.hanzi,
      pinyin: correct.pinyin,
      isMatch: true,
      speakHanzi: correct.hanzi,
    };
  }
  const other = pickRandom(VOCAB.filter((p) => p.hanzi !== correct.hanzi));
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
  const target = pickRandom(VOCAB);
  const wrong = randomPinyinDistractors(target.pinyin, 3);
  return {
    target,
    choices: shuffle([target.pinyin, ...wrong]),
  };
}

export function buildBubbleRoundFromQuiz(): BubbleRound {
  const q = pickRandom(SYLLABLE_QUIZ);
  const toneWrong = q.wrong.slice(0, 3);
  const wrong =
    toneWrong.length >= 3
      ? toneWrong
      : [...toneWrong, ...randomPinyinDistractors(q.pinyin, 3 - toneWrong.length)];
  return {
    target: { id: q.pinyin, hanzi: q.char, pinyin: q.pinyin },
    choices: shuffle([q.pinyin, ...wrong.slice(0, 3)]),
  };
}

/** Mix vocabulary + tone-trick quiz for more variety */
export function buildBubbleRoundMixed(): BubbleRound {
  return Math.random() < 0.45 ? buildBubbleRoundFromQuiz() : buildBubbleRound();
}

export { TONE_QUIZ, pickRandom };
