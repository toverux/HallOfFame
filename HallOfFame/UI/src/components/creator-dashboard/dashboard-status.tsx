import { LocalizedString } from 'cs2/l10n';
import { Button, Icon } from 'cs2/ui';
import type { ReactElement } from 'react';
import { locElementToReactNode } from '../../area-menu/menu-controls/menu-controls-utils';
import { useTranslate } from '../../utils';
import * as styles from './dashboard-status.module.scss';

/**
 * What the panel's body shows in place of the grid while there is no collection to show.
 */
export function DashboardLoading(): ReactElement {
  const translate = useTranslate();

  return (
    <div className={styles.status} data-dashboard-state='loading'>
      <Icon src={progressSrc} tinted={true} className={styles.statusSpinner} />

      <div className={styles.statusLoading}>{translate('HallOfFame.Common.LOADING')}</div>
    </div>
  );
}

/**
 * A failed fetch, what failed in `title`, why in `error`, and a retry.
 */
export function DashboardError({
  title,
  error,
  onRetry
}: Readonly<{
  title: string;
  error: LocalizedString;
  onRetry: () => void;
}>): ReactElement {
  const translate = useTranslate();

  return (
    <div className={styles.status} data-dashboard-state='error'>
      <div
        className={styles.statusImage}
        style={{ backgroundImage: 'url(Media/Game/Icons/AdvisorTrafficAccident.svg)' }}
      />

      <strong className={styles.statusTitle}>{translate(title)}</strong>

      <div className={styles.statusMessage}>
        <LocalizedString
          id={error.id}
          fallback={error.value}
          args={{
            ERROR_MESSAGE: locElementToReactNode(error.args?.ERROR_MESSAGE, 'Unknown error')
          }}
        />
      </div>

      <Button className={styles.statusButton} variant='primary' onSelect={onRetry}>
        {translate('HallOfFame.UI.Dashboard.ACTION[Retry]')}
      </Button>
    </div>
  );
}

/**
 * Neutral about why the collection is empty, which the panel cannot know:
 * never uploaded, or everything deleted.
 */
export function DashboardEmpty(): ReactElement {
  const translate = useTranslate();

  return (
    <div className={styles.status} data-dashboard-state='empty'>
      <div className={styles.statusMessage}>{translate('HallOfFame.UI.Dashboard.EMPTY')}</div>
    </div>
  );
}

const progressSrc = 'Media/Glyphs/Progress.svg';
