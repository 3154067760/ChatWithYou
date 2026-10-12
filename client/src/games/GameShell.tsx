import { ReactNode } from 'react';
import { ui } from '../i18n/strings';

type Props = {
  title: string;
  subtitle?: string;
  onBack: () => void;
  hud?: ReactNode;
  children: ReactNode;
};

export function GameShell({ title, subtitle, onBack, hud, children }: Props) {
  return (
    <div className="game-v2">
      <header className="game-v2-header">
        <button type="button" className="back" onClick={onBack}>{ui.back}</button>
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="game-v2-sub">{subtitle}</p>}
        </div>
      </header>
      {hud && <div className="game-v2-hud">{hud}</div>}
      <div className="game-v2-body">{children}</div>
    </div>
  );
}
