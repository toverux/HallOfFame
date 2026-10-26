import { Button, type Element, type ScrollController } from 'cs2/ui';
import { type ReactElement, useEffect, useRef, useState } from 'react';
import { useTranslate } from '../../utils';
import * as bindings from '../../utils/bindings';
import { TextInput } from '../../vanilla-modules/game-ui/common/input/text/text-input';
import { TooltipLayout } from '../../vanilla-modules/game-ui/common/tooltip/description-tooltip/description-tooltip';
import { Tooltip } from '../tooltip';
import * as styles from './description-field.module.scss';

// The server refuses a longer description.
const DESCRIPTION_MAX_LENGTH = 4000;

/**
 * The screenshot's description, a textarea that expands while focused or filled,
 * with its formatting help, a Clear button, a character count,
 * and a Restore button bringing back a saved description when it is empty.
 */
export function DescriptionField({
  value,
  savedDescription,
  scrollController,
  hint = true,
  onChange
}: Readonly<{
  value: string;
  // Whether the first-time explanation shows under the label; the formatting help link stays.
  hint?: boolean;
  // What Restore brings back, no Restore button when absent or empty.
  savedDescription?: string | undefined;
  // The enclosing scrollable's controller, which brings the expanded textarea into view.
  scrollController?: ScrollController | undefined;
  onChange: (description: string) => void;
}>): ReactElement {
  const translate = useTranslate();

  // Also the headings of the virtual keyboard console and handheld players type on.
  const descriptionLabel =
    translate('HallOfFame.UI.Game.ScreenshotUploadPanel.FORM_DESCRIPTION_LABEL') ?? '';

  const descriptionHint =
    translate('HallOfFame.UI.Game.ScreenshotUploadPanel.FORM_DESCRIPTION_DESCRIPTION') ?? '';

  const formattingHelpLabel = translate(
    'HallOfFame.UI.Game.ScreenshotUploadPanel.FORM_DESCRIPTION_FORMATTING'
  );

  // Plain paragraphs rather than the tooltip's `description`, which renders markdown and would
  // turn the syntax it explains into the formatting it produces.
  const formattingHelpLines = translate(
    'HallOfFame.UI.Game.ScreenshotUploadPanel.FORM_DESCRIPTION_FORMATTING_TOOLTIP'
  )
    ?.split('\n')
    .map(line => <p key={line}>{line}</p>);

  const textareaContainerRef = useRef<HTMLDivElement>(null);

  const [textareaFocused, setTextareaFocused] = useState(false);

  // When the textarea is focused, scroll it fully into view.
  useEffect(() => {
    if (!(textareaFocused && textareaContainerRef.current)) {
      return;
    }

    // The textarea expands when focused; wait for the textarea row count to be set and rendered.
    setTimeout(() => {
      scrollController?.scrollIntoView(textareaContainerRef.current as unknown as Element);
    }, 100 /* for some reason the textarea takes ages to resize */);
  }, [textareaContainerRef, scrollController, textareaFocused]);

  return (
    <div ref={textareaContainerRef} className={styles.field} onMouseEnter={bindings.playHoverSound}>
      <label>
        {descriptionLabel}
        <br />
        <small>
          {/* Cohtml's inline layout, so the link flows on after the hint's last word.
              Spread because the attribute is not in React's typings. */}
          <p {...{ cohinline: 'cohinline' }}>
            {hint && `${descriptionHint} `}
            <Tooltip
              direction='down'
              tooltip={<TooltipLayout title={formattingHelpLabel} content={formattingHelpLines} />}>
              <span className={styles.formattingHelp}>
                {/* Inline SVG: the inline layout draws no mask, so a tinted `Icon` vanishes,
                    and the game's `Media/Glyphs/Info.svg` as an `<img>` is black. */}
                <svg viewBox='0 0 32 32' className={styles.formattingHelpIcon}>
                  <path d='m14.5 10h3v3h-3z' />
                  <path d='m14.5 14.5h3v7.5h-3z' />
                  <circle cx='16' cy='16' r='11.5' fill='none' strokeWidth='3' />
                </svg>
                {formattingHelpLabel}
              </span>
            </Tooltip>
          </p>
        </small>
      </label>

      <div className={styles.textareaWrapper}>
        <TextInput
          // A defined `multiline` is what makes this a `<textarea>`, of that many rows.
          // oxlint-disable-next-line no-magic-numbers - expanded vs collapsed textarea row count
          multiline={textareaFocused || value.length > 0 ? 5 : 1}
          maxLength={DESCRIPTION_MAX_LENGTH}
          value={value}
          // A description is edited rather than replaced, so the caret belongs at the end.
          selectAllOnFocus={false}
          vkTitle={descriptionLabel}
          vkDescription={descriptionHint}
          onFocus={() => setTextareaFocused(true)}
          onBlur={() => setTextareaFocused(false)}
          onChange={event => onChange(event.target.value)}
        />

        {(textareaFocused || value.length > 0) && (
          <div className={styles.textareaControls}>
            {value.length == 0 && savedDescription && (
              <Button
                variant='default'
                className={styles.textareaControlsButton}
                onMouseDown={event => event.preventDefault()}
                onClick={() => onChange(savedDescription)}>
                {translate('HallOfFame.UI.Game.ScreenshotUploadPanel.FORM_DESCRIPTION_RESTORE')}
              </Button>
            )}

            <Button
              variant='default'
              className={styles.textareaControlsButton}
              // Use visibility to avoid a small layout shift when the button appears.
              style={{ visibility: value.length > 0 ? 'visible' : 'hidden' }}
              onClick={() => onChange('')}>
              {translate('Editor.CLEAR', 'Clear')}
            </Button>

            <div style={{ flex: 1 }} />

            <span>
              {/* oxlint-disable-next-line react/jsx-no-literals - typographic symbol, not translatable */}
              {value.length}&thinsp;/&thinsp;{DESCRIPTION_MAX_LENGTH}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
