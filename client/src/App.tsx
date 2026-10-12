import { useEffect, useMemo, useState } from 'react';
import {
  PINYIN_SECTIONS,
  SYLLABLE_QUIZ,
  TONE_QUIZ,
  pickRandom,
  shuffle,
  type PinyinSectionId,
  type Tone,
} from './data/pinyin';
import { CheckInCalendar } from './components/CheckInCalendar';
import { GamesHub } from './components/GamesHub';
import { PinyinCard } from './components/PinyinCard';
import { StoryReader } from './components/StoryReader';
import { BubblePopGame } from './games/BubblePopGame';
import { SnapMatchGame } from './games/SnapMatchGame';
import { ToneClimbGame } from './games/ToneClimbGame';
import { STORIES, getStoryById } from './data/stories';
import { useSpeech } from './hooks/useSpeech';
import { LEARNER_NAME } from './config';
import { TONE_LABELS_EN, ui } from './i18n/strings';
import { addStars, getStars } from './utils';
import { countCheckInsInMonth, isCheckedInOn, recordDailyCheckIn, toDateKey } from './utils/checkIn';

type Screen =
  | 'home'
  | 'learn'
  | 'listen'
  | 'tone'
  | 'stories'
  | 'story'
  | 'games'
  | 'game-bubble'
  | 'game-snap'
  | 'game-climb'
  | 'checkin';

export default function App() {
  const { speakPinyin, speakChar, speakStoryLine, speakStoryAll } = useSpeech();
  const [screen, setScreen] = useState<Screen>('home');
  const [activeStoryId, setActiveStoryId] = useState<string | null>(null);
  const [stars, setStars] = useState(getStars());
  const [learnSection, setLearnSection] = useState<PinyinSectionId>('shengmu');

  const [listenQ, setListenQ] = useState(() => pickRandom(SYLLABLE_QUIZ));
  const [listenOptions, setListenOptions] = useState<string[]>([]);
  const [listenFeedback, setListenFeedback] = useState<string | null>(null);

  const [toneQ, setToneQ] = useState(() => pickRandom(TONE_QUIZ));
  const [toneFeedback, setToneFeedback] = useState<string | null>(null);
  const [gameToast, setGameToast] = useState<string | null>(null);
  const [checkInTick, setCheckInTick] = useState(0);
  const toneOptions = useMemo(() => shuffle(toneQ.options), [toneQ]);

  const todayKey = toDateKey(new Date());
  const monthCheckIns = useMemo(() => {
    void checkInTick;
    const n = new Date();
    return countCheckInsInMonth(n.getFullYear(), n.getMonth());
  }, [checkInTick]);

  useEffect(() => {
    recordDailyCheckIn();
    setCheckInTick((t) => t + 1);
  }, []);

  const awardGameWin = () => {
    setStars(addStars(3));
    setGameToast(ui.gameWin);
    setTimeout(() => setGameToast(null), 2500);
  };

  useEffect(() => {
    const opts = shuffle([listenQ.pinyin, ...listenQ.wrong]);
    setListenOptions(opts);
    setListenFeedback(null);
  }, [listenQ]);

  useEffect(() => {
    setToneFeedback(null);
  }, [toneQ]);

  const learnSectionData =
    PINYIN_SECTIONS.find((s) => s.id === learnSection) ?? PINYIN_SECTIONS[0];

  const nextListen = () => {
    setListenQ(pickRandom(SYLLABLE_QUIZ));
  };

  const nextTone = () => {
    setToneQ(pickRandom(TONE_QUIZ));
  };

  const onListenAnswer = (choice: string) => {
    if (choice === listenQ.pinyin) {
      setListenFeedback(ui.correctStar);
      setStars(addStars(1));
      setTimeout(nextListen, 900);
    } else {
      setListenFeedback(ui.listenWrong);
    }
  };

  const onToneAnswer = (tone: Tone) => {
    if (tone === toneQ.tone) {
      setToneFeedback(ui.toneCorrect);
      setStars(addStars(1));
      setTimeout(nextTone, 900);
    } else {
      setToneFeedback(ui.toneWrong(toneQ.char, TONE_LABELS_EN[toneQ.tone]));
    }
  };

  const home = (
    <div className="screen home-screen">
      <header className="hero">
        <p className="hero-badge">{ui.badge}</p>
        <h1>{ui.appName}</h1>
        <p className="hero-desc">{ui.tagline}</p>
      </header>

      <p className="welcome-line">{ui.welcome(LEARNER_NAME)}</p>
      <p className="stars-line">{ui.progress(stars)}</p>
      <p className="checkin-home-line">
        {ui.homeCheckInLine(monthCheckIns, isCheckedInOn(todayKey))}
      </p>

      <div className="menu-grid">
        <button type="button" className="menu-card menu-learn" onClick={() => setScreen('learn')}>
          <span className="menu-icon">📖</span>
          <strong>{ui.menuLearnTitle}</strong>
          <small>{ui.menuLearnDesc}</small>
        </button>
        <button type="button" className="menu-card menu-listen" onClick={() => setScreen('listen')}>
          <span className="menu-icon">👂</span>
          <strong>{ui.menuListenTitle}</strong>
          <small>{ui.menuListenDesc}</small>
        </button>
        <button type="button" className="menu-card menu-tone" onClick={() => setScreen('tone')}>
          <span className="menu-icon">🎵</span>
          <strong>{ui.menuToneTitle}</strong>
          <small>{ui.menuToneDesc}</small>
        </button>
        <button
          type="button"
          className="menu-card menu-stories"
          onClick={() => {
            setActiveStoryId(null);
            setScreen('stories');
          }}
        >
          <span className="menu-icon">📚</span>
          <strong>{ui.menuStoriesTitle}</strong>
          <small>{ui.menuStoriesDesc}</small>
        </button>
        <button type="button" className="menu-card menu-games" onClick={() => setScreen('games')}>
          <span className="menu-icon">🎮</span>
          <strong>{ui.menuGamesTitle}</strong>
          <small>{ui.menuGamesDesc}</small>
        </button>
        <button type="button" className="menu-card menu-checkin" onClick={() => setScreen('checkin')}>
          <span className="menu-icon">📅</span>
          <strong>{ui.menuCheckInTitle}</strong>
          <small>{ui.menuCheckInDesc}</small>
        </button>
      </div>
    </div>
  );

  const learn = (
    <div className="screen">
      <header className="sub-header">
        <button type="button" className="back" onClick={() => setScreen('home')}>{ui.back}</button>
        <h2>{ui.learnTitle}</h2>
      </header>
      <figure className="chart-figure">
        <img src="/images/pinyin-alphabet.png" alt={ui.chartAlt} />
      </figure>
      <div className="section-tabs">
        {PINYIN_SECTIONS.map((sec) => (
          <button
            key={sec.id}
            type="button"
            className={learnSection === sec.id ? 'active' : ''}
            onClick={() => setLearnSection(sec.id)}
          >
            {sec.tab}
          </button>
        ))}
      </div>
      <h3 className="section-title">
        {learnSectionData.title}
        <span className="section-title-zh"> ({learnSectionData.titleZh})</span>
      </h3>
      <p className="tip">{ui.learnTip}</p>
      <div className="card-grid">
        {learnSectionData.items.map((item) => (
          <PinyinCard key={`${learnSection}-${item.id}`} item={item} onSpeak={speakPinyin} />
        ))}
      </div>
    </div>
  );

  const listen = (
    <div className="screen">
      <header className="sub-header">
        <button type="button" className="back" onClick={() => setScreen('home')}>{ui.back}</button>
        <h2>{ui.listenTitle}</h2>
      </header>
      <div className="quiz-panel">
        <p className="quiz-prompt">{ui.listenPrompt}</p>
        <button
          type="button"
          className="big-speak"
          onClick={() => speakChar(listenQ.char)}
        >
          {ui.listenAgain(listenQ.char)}
        </button>
        <div className="options-grid">
          {listenOptions.map((opt) => (
            <button key={opt} type="button" className="option-btn" onClick={() => onListenAnswer(opt)}>
              {opt}
            </button>
          ))}
        </div>
        {listenFeedback && <p className="feedback">{listenFeedback}</p>}
        <button type="button" className="ghost" onClick={nextListen}>{ui.nextQuestion}</button>
      </div>
    </div>
  );

  const tone = (
    <div className="screen">
      <header className="sub-header">
        <button type="button" className="back" onClick={() => setScreen('home')}>{ui.back}</button>
        <h2>{ui.toneTitle}</h2>
      </header>
      <div className="quiz-panel">
        <p className="quiz-prompt">
          {ui.tonePrompt(toneQ.char, toneQ.base)}
        </p>
        <button type="button" className="big-speak" onClick={() => speakChar(toneQ.char)}>
          {ui.playSound}
        </button>
        <div className="tone-grid">
          {toneOptions.map((t) => (
            <button key={t} type="button" className="tone-btn" onClick={() => onToneAnswer(t)}>
              {TONE_LABELS_EN[t]}
            </button>
          ))}
        </div>
        {toneFeedback && <p className="feedback">{toneFeedback}</p>}
        <button type="button" className="ghost" onClick={nextTone}>{ui.nextQuestion}</button>
      </div>
    </div>
  );

  const activeStory = activeStoryId ? getStoryById(activeStoryId) : undefined;

  const stories = (
    <div className="screen">
      <header className="sub-header">
        <button type="button" className="back" onClick={() => setScreen('home')}>{ui.back}</button>
        <h2>{ui.storiesTitle}</h2>
      </header>
      <p className="tip">{ui.storiesTip}</p>
      <ul className="story-list">
        {STORIES.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              className="story-list-btn"
              onClick={() => {
                setActiveStoryId(s.id);
                setScreen('story');
              }}
            >
              <strong>{s.titleEn}</strong>
              <span>{s.titleZh}</span>
              <small>{s.summaryEn}</small>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

  const story =
    activeStory &&
    (
      <StoryReader
        story={activeStory}
        onBack={() => setScreen('stories')}
        onPlayLine={(i) => speakStoryLine(activeStory.lines[i])}
        onPlayAll={() => void speakStoryAll(activeStory.lines)}
      />
    );

  return (
    <div className="app-root">
      {screen === 'home' && home}
      {screen === 'learn' && learn}
      {screen === 'listen' && listen}
      {screen === 'tone' && tone}
      {screen === 'stories' && stories}
      {screen === 'story' && story}
      {screen === 'checkin' && (
        <CheckInCalendar
          onBack={() => {
            setCheckInTick((t) => t + 1);
            setScreen('home');
          }}
        />
      )}
      {screen === 'games' && (
        <GamesHub onBack={() => setScreen('home')} onPick={(id) => setScreen(`game-${id}`)} />
      )}
      {screen === 'game-bubble' && (
        <BubblePopGame
          onBack={() => setScreen('games')}
          speakChar={speakChar}
          onStar={awardGameWin}
        />
      )}
      {screen === 'game-snap' && (
        <SnapMatchGame
          onBack={() => setScreen('games')}
          speakChar={speakChar}
          onStar={awardGameWin}
        />
      )}
      {screen === 'game-climb' && (
        <ToneClimbGame
          onBack={() => setScreen('games')}
          speakChar={speakChar}
          onStar={awardGameWin}
        />
      )}
      {gameToast && <div className="toast">{gameToast}</div>}
    </div>
  );
}
