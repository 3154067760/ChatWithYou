import type { PinyinItem } from '../data/pinyin';
import { ui } from '../i18n/strings';

type Props = {
  item: PinyinItem;
  onSpeak: (item: PinyinItem) => void;
};

export function PinyinCard({ item, onSpeak }: Props) {
  return (
    <button type="button" className="pinyin-card" onClick={() => onSpeak(item)}>
      <span className="pinyin-card-main">{item.display}</span>
      <span className="pinyin-card-han">{item.hint}</span>
      <span className="pinyin-card-hint">{ui.cardTap}</span>
    </button>
  );
}
