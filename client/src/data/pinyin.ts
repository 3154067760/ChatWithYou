import { uniqueWordPairs } from './gamePairs';

export type Tone = 1 | 2 | 3 | 4;

export type PinyinSectionId =
  | 'shengmu'
  | 'dan-yunmu'
  | 'fu-yunmu'
  | 'qian-bi'
  | 'hou-bi'
  | 'zhengti';

export type PinyinItem = {
  id: string;
  display: string;
  /** 字母表上的参考汉字（与教材一致） */
  hint: string;
  speak: string;
  audio: string;
};

function audioPath(section: PinyinSectionId, id: string) {
  const safe = id.replace('ü', 'v');
  return `/audio/pinyin/${section}-${safe}.mp3`;
}

function item(section: PinyinSectionId, id: string, display: string, hint: string): PinyinItem {
  return {
    id,
    display,
    hint,
    speak: hint,
    audio: audioPath(section, id),
  };
}

/** Aligned with standard Hanyu Pinyin chart (reference Hanzi on cards). */
export const PINYIN_SECTIONS: {
  id: PinyinSectionId;
  title: string;
  tab: string;
  titleZh: string;
  items: PinyinItem[];
}[] = [
  {
    id: 'shengmu',
    title: '1. Initials (consonants)',
    tab: 'Initials',
    titleZh: '声母',
    items: [
      item('shengmu', 'b', 'b', '播'),
      item('shengmu', 'p', 'p', '泼'),
      item('shengmu', 'm', 'm', '摸'),
      item('shengmu', 'f', 'f', '佛'),
      item('shengmu', 'd', 'd', '得'),
      item('shengmu', 't', 't', '特'),
      item('shengmu', 'n', 'n', '讷'),
      item('shengmu', 'l', 'l', '了'),
      item('shengmu', 'g', 'g', '哥'),
      item('shengmu', 'k', 'k', '科'),
      item('shengmu', 'h', 'h', '喝'),
      item('shengmu', 'j', 'j', '鸡'),
      item('shengmu', 'q', 'q', '气'),
      item('shengmu', 'x', 'x', '西'),
      item('shengmu', 'zh', 'zh', '知'),
      item('shengmu', 'ch', 'ch', '吃'),
      item('shengmu', 'sh', 'sh', '狮'),
      item('shengmu', 'r', 'r', '日'),
      item('shengmu', 'z', 'z', '字'),
      item('shengmu', 'c', 'c', '刺'),
      item('shengmu', 's', 's', '丝'),
      item('shengmu', 'y', 'y', '医'),
      item('shengmu', 'w', 'w', '屋'),
    ],
  },
  {
    id: 'dan-yunmu',
    title: '2. Simple finals',
    tab: 'Simple',
    titleZh: '单韵母',
    items: [
      item('dan-yunmu', 'a', 'a', '啊'),
      item('dan-yunmu', 'o', 'o', '喔'),
      item('dan-yunmu', 'e', 'e', '鹅'),
      item('dan-yunmu', 'i', 'i', '衣'),
      item('dan-yunmu', 'u', 'u', '乌'),
      item('dan-yunmu', 'ü', 'ü', '鱼'),
    ],
  },
  {
    id: 'fu-yunmu',
    title: '3. Compound finals',
    tab: 'Compound',
    titleZh: '复韵母',
    items: [
      item('fu-yunmu', 'ai', 'ai', '爱'),
      item('fu-yunmu', 'ei', 'ei', '诶'),
      item('fu-yunmu', 'ui', 'ui', '威'),
      item('fu-yunmu', 'ao', 'ao', '袄'),
      item('fu-yunmu', 'ou', 'ou', '欧'),
      item('fu-yunmu', 'iu', 'iu', '优'),
      item('fu-yunmu', 'ie', 'ie', '耶'),
      item('fu-yunmu', 'üe', 'üe', '月'),
      item('fu-yunmu', 'er', 'er', '耳'),
    ],
  },
  {
    id: 'qian-bi',
    title: '4. Front nasal finals',
    tab: 'Front -n',
    titleZh: '前鼻韵母',
    items: [
      item('qian-bi', 'an', 'an', '安'),
      item('qian-bi', 'en', 'en', '嗯'),
      item('qian-bi', 'in', 'in', '音'),
      item('qian-bi', 'un', 'un', '温'),
      item('qian-bi', 'ün', 'ün', '云'),
    ],
  },
  {
    id: 'hou-bi',
    title: '5. Back nasal finals',
    tab: 'Back -ng',
    titleZh: '后鼻韵母',
    items: [
      item('hou-bi', 'ang', 'ang', '昂'),
      item('hou-bi', 'eng', 'eng', '亨'),
      item('hou-bi', 'ing', 'ing', '鹰'),
      item('hou-bi', 'ong', 'ong', '轰'),
    ],
  },
  {
    id: 'zhengti',
    title: '6. Whole syllables (recognition)',
    tab: 'Whole',
    titleZh: '整体认读',
    items: [
      item('zhengti', 'zhi', 'zhi', '织'),
      item('zhengti', 'chi', 'chi', '吃'),
      item('zhengti', 'shi', 'shi', '狮'),
      item('zhengti', 'ri', 'ri', '日'),
      item('zhengti', 'zi', 'zi', '字'),
      item('zhengti', 'ci', 'ci', '刺'),
      item('zhengti', 'si', 'si', '丝'),
      item('zhengti', 'yi', 'yi', '衣'),
      item('zhengti', 'wu', 'wu', '屋'),
      item('zhengti', 'yu', 'yu', '鱼'),
      item('zhengti', 'ye', 'ye', '爷'),
      item('zhengti', 'yue', 'yue', '月'),
      item('zhengti', 'yuan', 'yuan', '元'),
      item('zhengti', 'yin', 'yin', '音'),
      item('zhengti', 'yun', 'yun', '云'),
      item('zhengti', 'ying', 'ying', '鹰'),
    ],
  },
];

export const INITIALS = PINYIN_SECTIONS[0].items;

export const FINALS = PINYIN_SECTIONS.slice(1).flatMap((s) => s.items);

export function quizCharAudio(char: string) {
  return `/audio/quiz/${encodeURIComponent(char)}.mp3`;
}

/** 带声调练习：听音选拼音 */
export const SYLLABLE_QUIZ: { pinyin: string; char: string; wrong: string[] }[] = [
  { pinyin: 'mā', char: '妈', wrong: ['má', 'mǎ', 'mà'] },
  { pinyin: 'má', char: '麻', wrong: ['mā', 'mǎ', 'mà'] },
  { pinyin: 'mǎ', char: '马', wrong: ['mā', 'má', 'mà'] },
  { pinyin: 'mà', char: '骂', wrong: ['mā', 'má', 'mǎ'] },
  { pinyin: 'bā', char: '八', wrong: ['bá', 'bǎ', 'bà'] },
  { pinyin: 'bá', char: '拔', wrong: ['bā', 'bǎ', 'bà'] },
  { pinyin: 'bà', char: '爸', wrong: ['bā', 'bá', 'bǎ'] },
  { pinyin: 'dà', char: '大', wrong: ['dā', 'dá', 'dǎ'] },
  { pinyin: 'dì', char: '地', wrong: ['dī', 'dí', 'dǐ'] },
  { pinyin: 'lì', char: '力', wrong: ['lī', 'lí', 'lǐ'] },
  { pinyin: 'hǎo', char: '好', wrong: ['hāo', 'háo', 'hào'] },
  { pinyin: 'shuǐ', char: '水', wrong: ['shuī', 'shuí', 'shuì'] },
  { pinyin: 'tiān', char: '天', wrong: ['tián', 'tiǎn', 'tiàn'] },
  { pinyin: 'rén', char: '人', wrong: ['rēn', 'rěn', 'rèn'] },
  { pinyin: 'shū', char: '书', wrong: ['shú', 'shǔ', 'shù'] },
  { pinyin: 'chī', char: '吃', wrong: ['chí', 'chǐ', 'chì'] },
  { pinyin: 'xué', char: '学', wrong: ['xuē', 'xuě', 'xuè'] },
  { pinyin: 'yī', char: '一', wrong: ['yí', 'yǐ', 'yì'] },
  { pinyin: 'sì', char: '四', wrong: ['sī', 'sí', 'sǐ'] },
  { pinyin: 'wǒ', char: '我', wrong: ['wō', 'wó', 'wò'] },
  { pinyin: 'nǐ', char: '你', wrong: ['nī', 'ní', 'nì'] },
  { pinyin: 'tā', char: '他', wrong: ['tā', 'tá', 'tǎ'] },
  { pinyin: 'hē', char: '喝', wrong: ['hé', 'hě', 'hè'] },
  { pinyin: 'kàn', char: '看', wrong: ['kān', 'kǎn', 'kàn'] },
  { pinyin: 'tīng', char: '听', wrong: ['tíng', 'tǐng', 'tìng'] },
  { pinyin: 'shuō', char: '说', wrong: ['shuó', 'shuǒ', 'shuò'] },
  { pinyin: 'xiǎo', char: '小', wrong: ['xiāo', 'xiáo', 'xiào'] },
  { pinyin: 'duō', char: '多', wrong: ['duó', 'duǒ', 'duò'] },
  { pinyin: 'shǎo', char: '少', wrong: ['shāo', 'sháo', 'shào'] },
  { pinyin: 'shàng', char: '上', wrong: ['shāng', 'shǎng', 'shàng'] },
  { pinyin: 'xià', char: '下', wrong: ['xiā', 'xiá', 'xià'] },
  { pinyin: 'zhōng', char: '中', wrong: ['zhōng', 'zhóng', 'zhòng'] },
  { pinyin: 'guó', char: '国', wrong: ['guō', 'guǒ', 'guò'] },
  { pinyin: 'shān', char: '山', wrong: ['shān', 'shán', 'shàn'] },
  { pinyin: 'huó', char: '火', wrong: ['huō', 'huó', 'huò'] },
  { pinyin: 'sān', char: '三', wrong: ['sān', 'sán', 'sǎn'] },
  { pinyin: 'wǔ', char: '五', wrong: ['wū', 'wú', 'wǔ'] },
  { pinyin: 'liù', char: '六', wrong: ['liū', 'liú', 'liǔ'] },
  { pinyin: 'shí', char: '十', wrong: ['shī', 'shí', 'shì'] },
  { pinyin: 'māo', char: '猫', wrong: ['máo', 'mǎo', 'mào'] },
  { pinyin: 'gǒu', char: '狗', wrong: ['gōu', 'góu', 'gòu'] },
  { pinyin: 'chē', char: '车', wrong: ['chē', 'ché', 'chě'] },
  { pinyin: 'lái', char: '来', wrong: ['lāi', 'lái', 'lài'] },
  { pinyin: 'qù', char: '去', wrong: ['qū', 'qú', 'qù'] },
  { pinyin: 'bù', char: '不', wrong: ['bū', 'bú', 'bù'] },
  { pinyin: 'shì', char: '是', wrong: ['shī', 'shí', 'shì'] },
  { pinyin: 'hěn', char: '很', wrong: ['hēn', 'hén', 'hèn'] },
  { pinyin: 'ài', char: '爱', wrong: ['āi', 'ǎi', 'ài'] },
  { pinyin: 'lěng', char: '冷', wrong: ['lēng', 'lěng', 'lèng'] },
  { pinyin: 'rè', char: '热', wrong: ['rē', 'ré', 'rè'] },
  { pinyin: 'jiàn', char: '见', wrong: ['jiān', 'jiǎn', 'jiàn'] },
];

export const TONE_QUIZ: { base: string; char: string; tone: Tone; options: Tone[] }[] = [
  { base: 'ma', char: '妈', tone: 1, options: [1, 2, 3, 4] },
  { base: 'ma', char: '马', tone: 3, options: [1, 2, 3, 4] },
  { base: 'ba', char: '爸', tone: 4, options: [1, 2, 3, 4] },
  { base: 'da', char: '大', tone: 4, options: [1, 2, 3, 4] },
  { base: 'hao', char: '好', tone: 3, options: [1, 2, 3, 4] },
  { base: 'shui', char: '水', tone: 3, options: [1, 2, 3, 4] },
  { base: 'tian', char: '天', tone: 1, options: [1, 2, 3, 4] },
  { base: 'ren', char: '人', tone: 2, options: [1, 2, 3, 4] },
  { base: 'chi', char: '吃', tone: 1, options: [1, 2, 3, 4] },
  { base: 'xue', char: '学', tone: 2, options: [1, 2, 3, 4] },
  { base: 'wo', char: '我', tone: 3, options: [1, 2, 3, 4] },
  { base: 'ni', char: '你', tone: 3, options: [1, 2, 3, 4] },
  { base: 'ta', char: '他', tone: 1, options: [1, 2, 3, 4] },
  { base: 'shang', char: '上', tone: 4, options: [1, 2, 3, 4] },
  { base: 'xia', char: '下', tone: 4, options: [1, 2, 3, 4] },
  { base: 'zhong', char: '中', tone: 1, options: [1, 2, 3, 4] },
  { base: 'guo', char: '国', tone: 2, options: [1, 2, 3, 4] },
  { base: 'shan', char: '山', tone: 1, options: [1, 2, 3, 4] },
  { base: 'he', char: '河', tone: 2, options: [1, 2, 3, 4] },
  { base: 'ri', char: '日', tone: 4, options: [1, 2, 3, 4] },
  { base: 'yue', char: '月', tone: 4, options: [1, 2, 3, 4] },
  { base: 'huo', char: '火', tone: 3, options: [1, 2, 3, 4] },
  { base: 'yi', char: '一', tone: 1, options: [1, 2, 3, 4] },
  { base: 'san', char: '三', tone: 1, options: [1, 2, 3, 4] },
  { base: 'si', char: '四', tone: 4, options: [1, 2, 3, 4] },
  { base: 'wu', char: '五', tone: 3, options: [1, 2, 3, 4] },
  { base: 'liu', char: '六', tone: 4, options: [1, 2, 3, 4] },
  { base: 'qi', char: '七', tone: 1, options: [1, 2, 3, 4] },
  { base: 'ba', char: '八', tone: 1, options: [1, 2, 3, 4] },
  { base: 'jiu', char: '九', tone: 3, options: [1, 2, 3, 4] },
  { base: 'shi', char: '十', tone: 2, options: [1, 2, 3, 4] },
  { base: 'shou', char: '手', tone: 3, options: [1, 2, 3, 4] },
  { base: 'xin', char: '心', tone: 1, options: [1, 2, 3, 4] },
  { base: 'hong', char: '红', tone: 2, options: [1, 2, 3, 4] },
  { base: 'lan', char: '蓝', tone: 2, options: [1, 2, 3, 4] },
  { base: 'mao', char: '猫', tone: 1, options: [1, 2, 3, 4] },
  { base: 'gou', char: '狗', tone: 3, options: [1, 2, 3, 4] },
  { base: 'che', char: '车', tone: 1, options: [1, 2, 3, 4] },
  { base: 'lai', char: '来', tone: 2, options: [1, 2, 3, 4] },
  { base: 'qu', char: '去', tone: 4, options: [1, 2, 3, 4] },
  { base: 'shi', char: '是', tone: 4, options: [1, 2, 3, 4] },
  { base: 'hen', char: '很', tone: 3, options: [1, 2, 3, 4] },
  { base: 'ai', char: '爱', tone: 4, options: [1, 2, 3, 4] },
  { base: 'leng', char: '冷', tone: 3, options: [1, 2, 3, 4] },
  { base: 're', char: '热', tone: 4, options: [1, 2, 3, 4] },
  { base: 'jian', char: '见', tone: 4, options: [1, 2, 3, 4] },
  { base: 'ming', char: '明', tone: 2, options: [1, 2, 3, 4] },
  { base: 'nian', char: '年', tone: 2, options: [1, 2, 3, 4] },
];

export const TONE_LABELS: Record<Tone, string> = {
  1: '第一声 ˉ',
  2: '第二声 ˊ',
  3: '第三声 ˇ',
  4: '第四声 ˋ',
};

/** 生成音频脚本用：所有需要下载的条目 */
export function collectAudioTasks(): { outFile: string; text: string }[] {
  const tasks: { outFile: string; text: string }[] = [];
  for (const section of PINYIN_SECTIONS) {
    for (const it of section.items) {
      const safe = it.id.replace('ü', 'v');
      tasks.push({
        outFile: `pinyin/${section.id}-${safe}.mp3`,
        text: it.speak,
      });
    }
  }
  const chars = new Set<string>();
  for (const q of SYLLABLE_QUIZ) chars.add(q.char);
  for (const q of TONE_QUIZ) chars.add(q.char);
  for (const p of uniqueWordPairs()) chars.add(p.hanzi);
  for (const ch of chars) {
    tasks.push({ outFile: `quiz/${encodeURIComponent(ch)}.mp3`, text: ch });
  }
  return tasks;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
