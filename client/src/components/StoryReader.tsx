import type { Story } from '../data/stories';
import { ui } from '../i18n/strings';

type Props = {
  story: Story;
  onBack: () => void;
  onPlayLine: (lineIndex: number) => void;
  onPlayAll: () => void;
};

export function StoryReader({ story, onBack, onPlayLine, onPlayAll }: Props) {
  return (
    <div className="screen story-screen">
      <header className="sub-header">
        <button type="button" className="back" onClick={onBack}>{ui.back}</button>
        <h2>{story.titleEn}</h2>
      </header>

      <div className="story-header">
        <h3 className="story-title-zh">{story.titleZh}</h3>
        <p className="story-summary">{story.summaryEn}</p>
        <button type="button" className="big-speak" onClick={onPlayAll}>
          {ui.storyPlayAll}
        </button>
      </div>

      <ol className="story-lines">
        {story.lines.map((ln, index) => (
          <li key={index}>
            <button
              type="button"
              className="story-line-btn"
              onClick={() => onPlayLine(index)}
            >
              <span className="story-hanzi">{ln.hanzi}</span>
              <span className="story-pinyin">{ln.pinyin}</span>
              <span className="story-play-hint">{ui.storyTapLine}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
