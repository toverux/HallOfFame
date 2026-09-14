import { FormattedText, type FormattedTextTheme, MarkdownRenderer } from 'cs2/ui';
import { memo, type ReactElement, useMemo } from 'react';
import { snappyOnSelect } from '../../utils';
import * as styles from './details-row.module.scss';

/**
 * The controls line previewing a screenshot's description, which opens the details window.
 */
export const MenuControlsDetailsRow = memo(
  ({
    preview,
    onOpen
  }: Readonly<{
    preview: string;
    onOpen: () => void;
  }>): ReactElement => {
    // Built here rather than at module scope, so a missing game export costs this row rather than
    // the whole mod UI.
    const renderer = useMemo(() => new MarkdownRenderer(), []);

    return (
      <div className={styles.row} {...snappyOnSelect(onOpen)}>
        <FormattedText
          className={styles.rowPreview}
          text={preview}
          renderer={renderer}
          theme={previewTheme}
          nonInline={true}
        />
      </div>
    );
  }
);

// Every paragraph style reads as the surrounding line: a heading keeps its words but not its size,
// which would otherwise blow the one-line preview up.
const previewTheme: Partial<FormattedTextTheme> = {
  // oxlint-disable-next-line id-length - the vanilla theme's own key for a plain paragraph
  p: styles.rowPreviewText,
  h1: styles.rowPreviewText,
  h2: styles.rowPreviewText,
  h3: styles.rowPreviewText,
  h4: styles.rowPreviewText,
  h5: styles.rowPreviewText,
  h6: styles.rowPreviewText
};
