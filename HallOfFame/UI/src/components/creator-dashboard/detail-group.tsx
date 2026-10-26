import classNames from 'classnames';
import type { ReactElement, ReactNode } from 'react';
import { useTranslate } from '../../utils';
import * as styles from './detail-group.module.scss';

/**
 * A titled, framed group of the detail view's rows: the figures under the print, and the edit
 * form's fields, which share the one chrome.
 */
export function DetailGroup({
  titleId,
  className,
  children
}: Readonly<{
  titleId: string;
  className?: string | undefined;
  children: ReactNode;
}>): ReactElement {
  const translate = useTranslate();

  return (
    <div className={classNames(styles.group, className)}>
      <div className={styles.groupTitle}>{translate(titleId)}</div>

      {children}
    </div>
  );
}
