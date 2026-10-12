import { useMemo, useState } from 'react';
import { ui } from '../i18n/strings';
import {
  buildMonthCalendar,
  countCheckInsInMonth,
  getCheckInDateSet,
  recordDailyCheckIn,
  toDateKey,
} from '../utils/checkIn';

type Props = {
  onBack: () => void;
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function CheckInCalendar({ onBack }: Props) {
  const now = new Date();
  const todayKey = toDateKey(now);
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [dates, setDates] = useState(() => getCheckInDateSet());
  const [justChecked, setJustChecked] = useState(false);

  const monthLabel = useMemo(
    () =>
      new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      }),
    [viewYear, viewMonth]
  );

  const cells = useMemo(
    () => buildMonthCalendar(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const monthCount = countCheckInsInMonth(viewYear, viewMonth);
  const checkedToday = dates.has(todayKey);

  const shiftMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const onCheckIn = () => {
    const newDay = recordDailyCheckIn();
    setDates(getCheckInDateSet());
    if (newDay) setJustChecked(true);
  };

  return (
    <div className="screen checkin-screen">
      <header className="sub-header">
        <button type="button" className="back" onClick={onBack}>{ui.back}</button>
        <h2>{ui.checkInTitle}</h2>
      </header>
      <p className="tip">{ui.checkInTip}</p>

      <div className="checkin-summary">
        <span>{ui.checkInMonthCount(monthCount)}</span>
        {checkedToday ? (
          <span className="checkin-today-badge">{ui.checkInTodayDone}</span>
        ) : (
          <button type="button" className="checkin-btn" onClick={onCheckIn}>
            {ui.checkInTodayBtn}
          </button>
        )}
      </div>

      {justChecked && <p className="checkin-toast">{ui.checkInSuccess}</p>}

      <div className="checkin-month-bar">
        <button type="button" className="checkin-nav" onClick={() => shiftMonth(-1)} aria-label={ui.checkInPrev}>
          ‹
        </button>
        <strong>{monthLabel}</strong>
        <button type="button" className="checkin-nav" onClick={() => shiftMonth(1)} aria-label={ui.checkInNext}>
          ›
        </button>
      </div>

      <div className="checkin-weekdays">
        {WEEKDAYS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>

      <div className="checkin-grid">
        {cells.map((cell, i) => {
          if (cell.day === null || !cell.dateKey) {
            return <div key={`e-${i}`} className="checkin-cell empty" />;
          }
          const checked = dates.has(cell.dateKey);
          const isToday = cell.dateKey === todayKey;
          return (
            <div
              key={cell.dateKey}
              className={`checkin-cell ${checked ? 'checked' : ''} ${isToday ? 'today' : ''}`}
              title={checked ? ui.checkInDayDone : undefined}
            >
              <span className="checkin-day-num">{cell.day}</span>
              {checked && <span className="checkin-dot" aria-hidden>✓</span>}
            </div>
          );
        })}
      </div>

      <p className="checkin-legend">
        <span className="checkin-legend-sample checked" /> {ui.checkInLegend}
      </p>
    </div>
  );
}
