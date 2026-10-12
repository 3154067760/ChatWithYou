export type StoryLine = {
  hanzi: string;
  pinyin: string;
  /** Text sent to TTS / audio file */
  speak: string;
  audio: string;
};

export type Story = {
  id: string;
  titleEn: string;
  titleZh: string;
  summaryEn: string;
  lines: StoryLine[];
};

function line(storyId: string, index: number, hanzi: string, pinyin: string): StoryLine {
  return {
    hanzi,
    pinyin,
    speak: hanzi,
    audio: `/audio/stories/${storyId}-${index}.mp3`,
  };
}

export const STORIES: Story[] = [
  {
    id: 'cat-and-dog',
    titleEn: 'The Kitten and the Puppy',
    titleZh: '小猫和小狗',
    summaryEn: 'Two friends play in the garden.',
    lines: [
      line('cat-and-dog', 0, '小花猫，咪咪叫。', 'Xiǎo huā māo, mī mī jiào.'),
      line('cat-and-dog', 1, '小黄狗，汪汪叫。', 'Xiǎo huáng gǒu, wāng wāng jiào.'),
      line('cat-and-dog', 2, '他们一起在花园里玩。', 'Tā men yì qǐ zài huā yuán lǐ wán.'),
      line('cat-and-dog', 3, '太阳很大，天气很好。', 'Tài yáng hěn dà, tiān qì hěn hǎo.'),
      line('cat-and-dog', 4, '他们回家喝水，真开心！', 'Tā men huí jiā hē shuǐ, zhēn kāi xīn!'),
    ],
  },
  {
    id: 'rainy-day',
    titleEn: 'A Rainy Day',
    titleZh: '下雨天',
    summaryEn: 'It rains, but the child has an umbrella.',
    lines: [
      line('rainy-day', 0, '今天下雨了。', 'Jīn tiān xià yǔ le.'),
      line('rainy-day', 1, '我有一把红色的伞。', 'Wǒ yǒu yì bǎ hóng sè de sǎn.'),
      line('rainy-day', 2, '雨点落在地上。', 'Yǔ diǎn luò zài dì shang.'),
      line('rainy-day', 3, '我慢慢走路去学校。', 'Wǒ màn màn zǒu lù qù xué xiào.'),
      line('rainy-day', 4, '老师笑着说：“你好！”', 'Lǎo shī xiào zhe shuō: “Nǐ hǎo!”'),
    ],
  },
  {
    id: 'at-school',
    titleEn: 'At School',
    titleZh: '在学校',
    summaryEn: 'Reading and writing Chinese characters.',
    lines: [
      line('at-school', 0, '早上八点，我上学。', 'Zǎo shang bā diǎn, wǒ shàng xué.'),
      line('at-school', 1, '教室里有很多书。', 'Jiào shì lǐ yǒu hěn duō shū.'),
      line('at-school', 2, '我读：“一、二、三、四。”', 'Wǒ dú: “Yī, èr, sān, sì.”'),
      line('at-school', 3, '我写汉字，手有点累。', 'Wǒ xiě Hàn zì, shǒu yǒu diǎn lèi.'),
      line('at-school', 4, '下课了，我和朋友说话。', 'Xià kè le, wǒ hé péng yǒu shuō huà.'),
    ],
  },
  {
    id: 'hello-china',
    titleEn: 'Hello, China!',
    titleZh: '你好，中国！',
    summaryEn: 'Greetings, food, and new friends.',
    lines: [
      line('hello-china', 0, '你好！我是学生。', 'Nǐ hǎo! Wǒ shì xué shēng.'),
      line('hello-china', 1, '中国很大，也很美。', 'Zhōng guó hěn dà, yě hěn měi.'),
      line('hello-china', 2, '我喜欢吃米饭和面条。', 'Wǒ xǐ huān chī mǐ fàn hé miàn tiáo.'),
      line('hello-china', 3, '北京的天安门很高。', 'Běi jīng de Tiān ān mén hěn gāo.'),
      line('hello-china', 4, '再见！明天见！', 'Zài jiàn! Míng tiān jiàn!'),
    ],
  },
];

export function getStoryById(id: string): Story | undefined {
  return STORIES.find((s) => s.id === id);
}

export function collectStoryAudioTasks(): { outFile: string; text: string }[] {
  const tasks: { outFile: string; text: string }[] = [];
  for (const story of STORIES) {
    story.lines.forEach((ln, index) => {
      tasks.push({
        outFile: `stories/${story.id}-${index}.mp3`,
        text: ln.speak,
      });
    });
  }
  return tasks;
}
