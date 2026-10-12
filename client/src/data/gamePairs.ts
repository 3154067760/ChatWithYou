/** Hanzi ↔ pinyin word list for arcade games & quizzes */
export type WordPair = {
  id: string;
  hanzi: string;
  pinyin: string;
};

export const WORD_PAIRS: WordPair[] = [
  { id: 'ma1', hanzi: '妈', pinyin: 'mā' },
  { id: 'ba1', hanzi: '爸', pinyin: 'bà' },
  { id: 'ma3', hanzi: '马', pinyin: 'mǎ' },
  { id: 'ni3', hanzi: '你', pinyin: 'nǐ' },
  { id: 'hao3', hanzi: '好', pinyin: 'hǎo' },
  { id: 'shui3', hanzi: '水', pinyin: 'shuǐ' },
  { id: 'tian1', hanzi: '天', pinyin: 'tiān' },
  { id: 'ren2', hanzi: '人', pinyin: 'rén' },
  { id: 'chi1', hanzi: '吃', pinyin: 'chī' },
  { id: 'xue2', hanzi: '学', pinyin: 'xué' },
];

export const CRUSH_TILES = ['mā', 'mǎ', 'bà', 'nǐ', 'hǎo', 'shuǐ', 'tiān', 'rén'] as const;
