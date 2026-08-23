import classNames from 'classnames';
import { FOCUS_DISABLED } from 'cs2/input';
import { Dropdown, DropdownItem, type DropdownTheme, DropdownToggle } from 'cs2/ui';
import {
  memo,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type SyntheticEvent,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { getClassesModule, useTranslate } from '../../utils';
import type * as bindings from '../../utils/bindings';
import { defaultButtonSounds } from '../../vanilla-modules/game-ui/common/input/button/button';
import { DropdownContext } from '../../vanilla-modules/game-ui/common/input/dropdown/dropdown';
import { TextInput } from '../../vanilla-modules/game-ui/common/input/text/text-input';
import { type HighlightRange, searchAssetMods } from './asset-mod-search';
import * as styles from './asset-mod-dropdown.module.scss';
import * as shared from './shared.module.scss';

const coDropdownTheme = getClassesModule(
  'game-ui/common/input/dropdown/themes/default.module.scss',
  [
    'dropdownItem',
    'dropdownMenu',
    'dropdownPopup',
    'dropdownToggle',
    'indicator',
    'label',
    'scrollable'
  ]
);

const dropdownTheme: DropdownTheme = {
  ...coDropdownTheme,
  dropdownToggle: classNames(coDropdownTheme.dropdownToggle, styles.dropdownToggle),
  dropdownPopup: classNames(
    coDropdownTheme.dropdownPopup,
    styles.dropdownPopup,
    shared.scrollableTrackCustomization
  ),
  dropdownItem: classNames(coDropdownTheme.dropdownItem, styles.dropdownItem)
};

// The toggle spans the whole control, so its hover sound would fire on the way to anything else.
const toggleSounds = { ...defaultButtonSounds, hover: null };

export const AssetModDropdown = memo(AssetModDropdownBase);

/**
 * Picks the asset mod a screenshot showcases, filtering the list as the player types.
 * It owns the filter state so that a keystroke re-renders the dropdown alone, not the whole form.
 */
function AssetModDropdownBase({
  assetMods,
  showcasedMod,
  isInvalid,
  onSelect
}: Readonly<{
  assetMods: readonly bindings.JsonMod[];
  showcasedMod: bindings.JsonMod | undefined;
  isInvalid: boolean;
  onSelect: (mod: bindings.JsonMod) => void;
}>): ReactElement {
  const translate = useTranslate();

  const [filter, setFilter] = useState('');

  const items = useMemo(
    () =>
      searchAssetMods(assetMods, filter).map(({ mod, displayNameRanges, authorRanges }) => (
        <DropdownItem
          key={mod.id}
          value={mod}
          // The game's focus tree compares keys by value, so a string keeps a row attached across
          // the re-render every keystroke causes.
          focusKey={`mod-${mod.id}`}
          onChange={onSelect}>
          <div
            className={styles.dropdownItemImage}
            style={{ backgroundImage: `url(${mod.thumbnailPath})` }}
          />

          <div className={styles.dropdownItemText}>
            {displayNameRanges.length > 0 ? (
              <HighlightedText text={mod.displayName} ranges={displayNameRanges} />
            ) : (
              mod.displayName
            )}
          </div>

          <div className={styles.dropdownItemAuthor}>
            {authorRanges.length > 0 ? (
              <HighlightedText text={mod.author} ranges={authorRanges} />
            ) : (
              mod.author
            )}
          </div>
        </DropdownItem>
      )),
    [assetMods, filter, onSelect]
  );

  const content =
    items.length > 0 ? (
      items
    ) : (
      <div className={styles.dropdownFilterEmpty}>
        {translate('HallOfFame.UI.Game.ScreenshotUploadPanel.FORM_SHOWCASE_ASSET_FILTER_EMPTY')}
      </div>
    );

  return (
    <Dropdown theme={dropdownTheme} content={content}>
      <AssetModDropdownToggle
        showcasedMod={showcasedMod}
        isInvalid={isInvalid}
        filter={filter}
        onFilterChange={setFilter}
      />
    </Dropdown>
  );
}

/**
 * The dropdown's toggle, doubling as the filter field while the menu is open.
 * It stays a vanilla `DropdownToggle` so the game keeps owning focus, sounds, and the controller
 * hint.
 */
function AssetModDropdownToggle({
  showcasedMod,
  isInvalid,
  filter,
  onFilterChange
}: Readonly<{
  showcasedMod: bindings.JsonMod | undefined;
  isInvalid: boolean;
  filter: string;
  onFilterChange: (filter: string) => void;
}>): ReactElement {
  const translate = useTranslate();

  const { visible, hide } = useContext(DropdownContext);

  const inputRef = useRef<HTMLInputElement>(null);

  // Clearing on open rather than on close is what makes every dismissal path reset the filter: the
  // vanilla dropdown closes itself on a mousedown outside the menu without going through `hide`,
  // so its `onToggle` never fires on the most common one.
  // Before paint, so that reopening never shows the previous filter for a frame.
  useLayoutEffect(() => {
    if (visible) {
      onFilterChange('');
      inputRef.current?.focus();
    }
  }, [visible, onFilterChange]);

  // Both label the control on screen and head the virtual keyboard console players type on.
  const selectAssetLabel =
    translate('HallOfFame.UI.Game.ScreenshotUploadPanel.FORM_SHOWCASE_ASSET_SELECT_ASSET') ?? '';

  const filterLabel =
    translate('HallOfFame.UI.Game.ScreenshotUploadPanel.FORM_SHOWCASE_ASSET_FILTER') ?? '';

  // `TextInput` blurs a single-line field on both Escape and Enter, and neither key means anything
  // to it beyond that: Escape has to close the menu here, and Enter has nothing to submit, so the
  // field takes the focus back rather than stranding the player on a menu that ignores typing.
  // Cohtml leaves `key` empty on these events, hence `code`.
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.code == 'Escape') {
        hide();
      } else if (event.code == 'Enter' || event.code == 'NumpadEnter') {
        inputRef.current?.focus();
      }
    },
    [hide]
  );

  return (
    <DropdownToggle
      className={classNames({
        [styles.dropdownToggleFiltering]: visible,
        [styles.dropdownToggleInvalid]: isInvalid
      })}
      sounds={toggleSounds}>
      <div
        className={classNames(dropdownTheme.dropdownItem, styles.dropdownPreviewItem, {
          [styles.dropdownFilter]: visible
        })}>
        {showcasedMod && (
          <div
            className={styles.dropdownItemImage}
            style={{ backgroundImage: `url(${showcasedMod.thumbnailPath})` }}
          />
        )}

        {visible ? (
          <div
            className={styles.dropdownFilterField}
            // The toggle is a vanilla button whose click toggles the menu, so a pointer event
            // landing on the field must not reach it.
            onMouseDown={stopPointerEvent}
            onMouseUp={stopPointerEvent}
            onClick={stopPointerEvent}>
            <TextInput
              ref={inputRef}
              debugName='AssetModFilter'
              // The enclosing toggle is a leaf of the focus tree and refuses to register a child,
              // so the default key would log a failed registration on every open and a mismatched
              // unregistration on every close. Passing `allowFocusableChildren` to the toggle is
              // what would make the field reachable by a controller.
              focusKey={FOCUS_DISABLED}
              className={styles.dropdownFilterInput}
              value={filter}
              // A filter is refined rather than replaced, so the caret belongs at the end.
              selectAllOnFocus={false}
              vkTitle={selectAssetLabel}
              vkDescription={filterLabel}
              onChange={event => onFilterChange(event.target.value)}
              onKeyDown={handleKeyDown}
              onBack={hide}
            />

            {/* The vanilla placeholder shows only while blurred, hence this plain overlay. */}
            {filter.length == 0 && (
              <div className={styles.dropdownFilterPlaceholder}>
                {showcasedMod ? showcasedMod.displayName : filterLabel}
              </div>
            )}
          </div>
        ) : showcasedMod ? (
          <div className={styles.dropdownItemText}>{showcasedMod.displayName}</div>
        ) : (
          selectAssetLabel
        )}
      </div>
    </DropdownToggle>
  );
}

/**
 * Renders a searched field with its matched runs emphasized.
 * The runs are flex items of their own row container, which gives up the enclosing ellipsis.
 *
 * A field with nothing to emphasize is rendered as plain text by the call sites rather than here,
 * which is the common case: an unmatched second field on every row, and both fields on every row
 * once a wide match drops uFuzzy past its ranking threshold, and it stops reporting ranges at all.
 * Guarding inside this component instead would cost a fiber per such field on every keystroke.
 */
function HighlightedText({
  text,
  ranges
}: Readonly<{
  text: string;
  ranges: readonly HighlightRange[];
}>): ReactElement {
  const runs: ReactNode[] = [];
  let cursor = 0;

  for (const [start, end] of ranges) {
    runs.push(
      text.slice(cursor, start),
      <span key={start} className={styles.dropdownItemMatch}>
        {text.slice(start, end)}
      </span>
    );

    cursor = end;
  }

  runs.push(text.slice(cursor));

  // noinspection com.intellij.reactbuddy.ArrayToJSXMapInspection
  return <span className={styles.dropdownItemRuns}>{runs}</span>;
}

function stopPointerEvent(event: SyntheticEvent): void {
  event.stopPropagation();
}
