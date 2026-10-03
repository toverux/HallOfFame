import classNames from 'classnames';
import { Button, Icon } from 'cs2/ui';
import { memo, type ReactElement, type ReactNode } from 'react';
import apertureSharpSolidSrc from '../../icons/fontawesome/aperture-sharp-solid.svg';
import paradoxModsSolidSrc from '../../icons/paradox/paradox-mods-solid.svg';
import { useTranslate } from '../../utils';
import type * as bindings from '../../utils/bindings';
import { MenuControlsInputHintTooltip } from './input-hint-tooltip';
import type { DetailsRow } from './screenshot-details';
import type { DetailsTabId } from './screenshot-details-window';
import * as styles from './details-row.module.scss';

/**
 * The icon segments, one per kind of data a screenshot can carry besides its description, in
 * display order.
 */
const rowIcons: ReadonlyArray<{
  readonly tab: DetailsTabId;
  readonly src: string;
  readonly iconClassName: string;
  readonly tooltipId: string;
  readonly isShown: (row: DetailsRow) => boolean;
}> = [
  {
    tab: 'photoModeSettings',
    src: apertureSharpSolidSrc,
    iconClassName: styles.rowIconDisc,
    tooltipId: 'HallOfFame.UI.Menu.MenuControls.DETAILS_ROW_TOOLTIP[Photo Mode Settings]',
    isShown: row => row.hasPhotoModeSettings
  },
  {
    tab: 'playset',
    src: paradoxModsSolidSrc,
    iconClassName: styles.rowIconHexagon,
    tooltipId: 'HallOfFame.UI.Menu.MenuControls.DETAILS_ROW_TOOLTIP[Playset]',
    isShown: row => row.hasPlayset
  }
];

/**
 * The row's icons, for the preloading the controls do on their behalf: the first screenshot
 * carrying a kind of data would otherwise fetch its icon on the frame it is meant to be drawn.
 */
// oxlint-disable-next-line react/only-export-components - no Fast Refresh in a Cohtml bundle
export const detailsRowPreloadedIcons: readonly string[] = rowIcons.map(icon => icon.src);

/**
 * The buttons opening the details window, each on its own tab: a preview of the screenshot's
 * description, and an icon for each other kind of data it carries.
 *
 * Without a description it is only icons, a pill sized to sit among the labels.
 * Each tooltip hints at the key opening the window, `inputBinding`.
 */
export const MenuControlsDetailsRow = memo(
  ({
    row,
    inputBinding,
    onOpen
  }: Readonly<{
    row: DetailsRow;
    inputBinding: bindings.ProxyBinding;
    onOpen: (tab: DetailsTabId) => void;
  }>): ReactElement => {
    const translate = useTranslate();

    // The key always opens the window on Description, whichever segment hints at it.
    const inputHint = translate('HallOfFame.UI.Menu.MenuControls.DETAILS_ROW_INPUT_HINT');

    const icons = rowIcons.filter(icon => icon.isShown(row));

    // Each segment is its own button, opening on click rather than on press like the round
    // buttons, for the reason `snappyOnSelect` gives.
    return (
      <div className={classNames(styles.row, row.preview == undefined && styles.rowInline)}>
        {row.preview != undefined && (
          <DetailsRowSegment
            tooltip={translate('HallOfFame.UI.Menu.MenuControls.DETAILS_ROW_TOOLTIP[Description]')}
            inputBinding={inputBinding}
            inputHint={inputHint}
            hostClassName={styles.rowSegmentHostText}
            buttonClassName={styles.rowSegmentText}
            onSelect={() => onOpen('description')}>
            <span className={styles.rowText}>{row.preview}</span>
          </DetailsRowSegment>
        )}

        {icons.map((icon, index) => {
          const isFirst = row.preview == undefined && index == 0;
          const isLast = index == icons.length - 1;

          return (
            <DetailsRowSegment
              key={icon.tab}
              tooltip={translate(icon.tooltipId)}
              inputBinding={inputBinding}
              inputHint={inputHint}
              hostClassName={isFirst ? undefined : styles.rowSegmentHostDivided}
              buttonClassName={classNames(styles.rowSegmentIcon, {
                // A lone icon is against both ends at once, and stays a disc.
                [styles.rowSegmentIconLeading]: isFirst && !isLast,
                [styles.rowSegmentIconTrailing]: isLast && !isFirst
              })}
              onSelect={() => onOpen(icon.tab)}>
              <Icon
                src={icon.src}
                tinted={true}
                className={classNames(styles.rowIcon, icon.iconClassName)}
              />
            </DetailsRowSegment>
          );
        })}
      </div>
    );
  }
);

function DetailsRowSegment({
  tooltip,
  inputBinding,
  inputHint,
  hostClassName,
  buttonClassName,
  onSelect,
  children
}: Readonly<{
  tooltip: string | null;
  inputBinding: bindings.ProxyBinding;
  inputHint: string | null;
  hostClassName: string | undefined;
  buttonClassName: string;
  onSelect: () => void;
  children: ReactNode;
}>): ReactElement {
  // The span carries the divider outside the button, whose box would otherwise take the hairline
  // out of its own width and push its glyph off centre.
  return (
    <MenuControlsInputHintTooltip
      direction='down'
      binding={inputBinding}
      bindingLabel={inputHint}
      tooltip={tooltip}>
      <span className={classNames(styles.rowSegmentHost, hostClassName)}>
        <Button theme={segmentTheme} className={buttonClassName} onSelect={onSelect}>
          {children}
        </Button>
      </span>
    </MenuControlsInputHintTooltip>
  );
}

// Replaces the vanilla button look, which the segments do not wear.
const segmentTheme = { button: styles.rowSegment };
