import classNames from 'classnames';
import { FOCUS_DISABLED } from 'cs2/input';
import { Dropdown, DropdownItem, type DropdownTheme, DropdownToggle } from 'cs2/ui';
import {
  memo,
  type KeyboardEvent,
  type MutableRefObject,
  type ReactElement,
  type ReactNode,
  type SyntheticEvent,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { getClassesModule, selector, useTranslate } from '../../utils';
import type * as bindings from '../../utils/bindings';
import { defaultButtonSounds } from '../../vanilla-modules/game-ui/common/input/button/button';
import { DropdownContext } from '../../vanilla-modules/game-ui/common/input/dropdown/dropdown';
import { TextInput } from '../../vanilla-modules/game-ui/common/input/text/text-input';
import {
  useUniformSizeProvider,
  useVirtualList
} from '../../vanilla-modules/game-ui/common/scrolling/virtual-list/virtual-list';
import { type AssetModMatch, type HighlightRange, searchAssetMods } from './asset-mod-search';
import { deriveModThumbnailUri } from './asset-mod-thumbnail';
import * as styles from './asset-mod-dropdown.module.scss';
import * as shared from './shared.module.scss';

// A `Scrollable` is a wrapper holding the scrollbar tracks around the element that actually
// scrolls, and it is that inner element the menu has to read its scroll position from.
const coScrollableClasses = getClassesModule('game-ui/common/scrolling/scrollable.module.scss', [
  'content'
]);

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

  const searchedFilter = useDebouncedFilter(filter);

  const matches = useMemo(
    () => searchAssetMods(assetMods, searchedFilter),
    [assetMods, searchedFilter]
  );

  const content =
    matches.length > 0 ? (
      <AssetModMenu matches={matches} onSelect={onSelect} />
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
 * The open menu, rendering only the rows the popup can currently show.
 *
 * A playset runs to hundreds of asset mods, each row a focus-tree registration and a remote
 * thumbnail, which is more than the menu can build on every keystroke and stay responsive. Vanilla
 * answers this with a virtual list, and this component exists to host it: it mounts and unmounts
 * with the popup, which is what lets it hold the scroll container the list reads, and lets that
 * container exist for as long as the list does.
 */
function AssetModMenu({
  matches,
  onSelect
}: Readonly<{
  matches: readonly AssetModMatch[];
  onSelect: (mod: bindings.JsonMod) => void;
}>): ReactElement {
  const scrollableRef = useRef<HTMLElement | null>(null);

  // The scroll container is vanilla's, built by `Dropdown` around whatever content it is given and
  // never handed out as a ref, so the menu climbs out of a node of its own to reach it. What the
  // climb looks for is the `Scrollable`'s inner content element, not the `Scrollable` itself: the
  // outer one carries the scrollbar tracks and never moves, so a scroll position read from it is
  // always zero.
  const findScrollable = useCallback((node: HTMLElement | null) => {
    scrollableRef.current = node?.closest(selector(coScrollableClasses.content)) ?? null;
  }, []);

  // A new match set is a new list, so it has to start at the top. Neither vanilla's `Scrollable`
  // nor the virtual list ever rewinds one: the list maps whatever scroll position survived onto the
  // new rows, which opens a filtered list part-way down, past the very matches ranked best, and
  // shows nothing at all when the new set is shorter than the position it kept.
  useEffect(() => {
    if (scrollableRef.current) {
      scrollableRef.current.scrollTop = 0;
    }
  }, [matches]);

  const rowHeight = useMeasuredRowHeight(scrollableRef);

  const sizeProvider = useUniformSizeProvider(rowHeight, matches.length, MENU_OVERSCAN);

  const renderItem = useCallback(
    (index: number) => {
      const match = matches[index];

      // The list collects these into a plain array, so the key is ours to give. Keying on the mod
      // rather than on the position is what lets a row scrolled from one slot to the next keep its
      // element, and with it the thumbnail it already loaded.
      return match && <AssetModMenuItem key={match.mod.id} match={match} onSelect={onSelect} />;
    },
    [matches, onSelect]
  );

  const { list } = useVirtualList(scrollableRef, sizeProvider, 'vertical', undefined, renderItem);

  return (
    <>
      {/* The node `findScrollable` climbs out of, which is what puts the menu in the DOM. */}
      <div ref={findScrollable} />

      {list}
    </>
  );
}

/**
 * One selectable asset mod, with the runs that matched the filter emphasized in each field.
 */
function AssetModMenuItem({
  match: { mod, displayNameRanges, authorRanges },
  onSelect
}: Readonly<{
  match: AssetModMatch;
  onSelect: (mod: bindings.JsonMod) => void;
}>): ReactElement {
  return (
    <DropdownItem
      value={mod}
      // The game's focus tree compares keys by value, so a string keeps a row attached across the
      // re-render every keystroke causes.
      focusKey={`mod-${mod.id}`}
      onChange={onSelect}>
      <div
        className={styles.dropdownItemImage}
        style={{ backgroundImage: `url(${deriveModThumbnailUri(mod.thumbnailPath)})` }}
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
  );
}

/**
 * Measures how tall one row is, which the virtual list needs in pixels to place rows it never
 * renders.
 *
 * A row's height is a line of `--fontSizeXL` over vanilla's own padding, both scaled by the
 * player's font-size setting on top of the viewport scaling every `rem` in the mod already follows,
 * so it is read off a rendered row rather than computed.
 *
 * Cohtml lays out on its own frame rather than on demand, so a row measures zero for as long as the
 * engine has not reached it, and no read taken while React is still committing can see it. The
 * measurement therefore retries on animation frames until a row answers with a height, leaving the
 * opening frames on the estimate.
 */
function useMeasuredRowHeight(scrollable: MutableRefObject<HTMLElement | null>): number {
  const [rowHeight, setRowHeight] = useState(ESTIMATED_ROW_HEIGHT_PX);

  useEffect(() => {
    let frame = 0;

    function measure(): void {
      const row = scrollable.current?.querySelector(selector(dropdownTheme.dropdownItem));

      if (row instanceof HTMLElement && row.offsetHeight > 0) {
        setRowHeight(row.offsetHeight);
      } else {
        frame = requestAnimationFrame(measure);
      }
    }

    measure();

    return () => cancelAnimationFrame(frame);
  }, [scrollable]);

  return rowHeight;
}

/**
 * Rows kept rendered past each edge of the viewport, so scrolling reveals a row that is already
 * there.
 * Low on purpose: every extra row is another thumbnail fetched from the CDN, which is the cost this
 * list exists to bound.
 */
const MENU_OVERSCAN = 3;

/**
 * What the first render assumes a row measures, before {@link useMeasuredRowHeight} replaces it
 * with the real one: vanilla's row padding plus a line of `--fontSizeXL`, which is what a row
 * measures at the resolution where a `rem` is a pixel.
 *
 * It is a pixel count where everything else here is in `rem`, because the value it feeds is one:
 * the engine resolves `rem` itself and hands nothing back, so there is no reading this in the
 * layout's own units without restating the game's own scaling rule. Being a resolution off is
 * cheap, and only for the frames before a real row answers.
 */
const ESTIMATED_ROW_HEIGHT_PX = 38;

/**
 * Holds the filter back a moment before the list acts on it, while the field itself stays
 * immediate.
 *
 * Every row carries a remote thumbnail, and cohtml drops an image the instant its last DOM
 * reference goes, so a filter reaching the list on every keystroke opens a fetch per newly matched
 * row and aborts it on the next one. Typing quickly, or holding backspace, churns through hundreds,
 * to the point the engine itself loses track of them and logs `Cannot abort request with ID`.
 * A pause short enough to stay invisible to the player is long enough that only the states they
 * actually stop on ever reach the DOM.
 *
 * An empty filter applies at once rather than being scheduled through the wait.
 */
function useDebouncedFilter(filter: string): string {
  const [debounced, setDebounced] = useState(filter);

  if (filter.length == 0 && debounced.length > 0) {
    setDebounced(filter);
  }

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(filter), FILTER_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [filter]);

  return debounced;
}

/**
 * How long a keystroke waits before the list is searched again.
 * Under the ~200ms a keypress-to-feedback delay starts being felt as lag, and above a fast typist's
 * inter-key interval, so a burst of typing settles into one search.
 */
const FILTER_DEBOUNCE_MS = 150;

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
            style={{ backgroundImage: `url(${deriveModThumbnailUri(showcasedMod.thumbnailPath)})` }}
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
