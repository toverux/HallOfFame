import { Button, FormattedText, type FormattedTextTheme, MarkdownRenderer } from 'cs2/ui';
import { memo, type ReactElement, useMemo } from 'react';
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

    // Opens on click rather than on press like the round buttons, for the reason `snappyOnSelect`
    // gives.
    return (
      <Button theme={rowTheme} onSelect={onOpen}>
        <FormattedText
          className={styles.rowPreview}
          text={preview}
          renderer={renderer}
          theme={previewTheme}
          nonInline={true}
        />
      </Button>
    );
  }
);

// Replaces the vanilla button look, which the row does not wear.
const rowTheme = { button: styles.row };

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
