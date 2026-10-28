import classNames from 'classnames';
import { AutoNavigationScope } from 'cs2/input';
import { type Localization, LocalizedNumber, LocalizedString, Unit } from 'cs2/l10n';
import {
  Button,
  FormattedParagraphs,
  type FormattedTextTheme,
  Icon,
  MarkdownRenderer,
  Scrollable
} from 'cs2/ui';
import {
  memo,
  type ReactElement,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import type { Mod, Screenshot } from '../../common';
import { ModalBackdrop, ModalHost } from '../../components/modal';
import { PreloadImages } from '../../components/preload-images';
import { Tooltip } from '../../components/tooltip';
import apertureDuotoneLightSrc from '../../icons/fontawesome/aperture-duotone-light.svg';
import apertureSharpSolidSrc from '../../icons/fontawesome/aperture-sharp-solid.svg';
import penLineDuotoneLightSrc from '../../icons/fontawesome/pen-line-duotone-light.svg';
import penLineSolidSrc from '../../icons/fontawesome/pen-line-solid.svg';
import paradoxModsSolidSrc from '../../icons/paradox/paradox-mods-solid.svg';
import populationSrc from '../../icons/paradox/population.svg';
import {
  deriveModThumbnailUri,
  getClassesModule,
  selectLocalizedName,
  useTranslate,
  useUniformVirtualList
} from '../../utils';
import * as bindings from '../../utils/bindings';
import {
  Checkbox,
  type CheckboxTheme
} from '../../vanilla-modules/game-ui/common/input/toggle/checkbox/checkbox';
import { Panel } from '../../vanilla-modules/game-ui/common/panel/panel';
import { PanelTitleBar } from '../../vanilla-modules/game-ui/common/panel/panel-title-bar';
import { iceflakePanelTheme } from '../../vanilla-modules/game-ui/common/panel/themes/iceflake-panel';
import { Tab, TabBar } from '../../vanilla-modules/game-ui/common/tabs/tabs';
import { TooltipLayout } from '../../vanilla-modules/game-ui/common/tooltip/description-tooltip/description-tooltip';
import { photoModeContainerClasses } from '../../vanilla-modules/game-ui/game/components/photo-mode/widgets/photo-mode-container';
import {
  type AssetCategory,
  type DetailsTabState,
  formatClockTime,
  type ModHints,
  type ModHintTone,
  type PhotoModeConditions,
  type PhotoModeWeather,
  type PhotoModeSection,
  type PhotoModeSetting,
  type PhotoModeTabState,
  defaultPlaysetFilter,
  isPlaysetToolboxShown,
  type PlaysetFilter,
  type PlaysetKind,
  type PlaysetTabState,
  type PlaysetView,
  selectModHints,
  selectPlaysetView,
  selectScreenshotDetails,
  toPhotoModeColorSliders
} from './screenshot-details';
import { SkyveLogo, SkyveVerdictBlock } from './skyve-verdict';
import { useDetailsContext, useViewerModIds } from './use-details-context';
import * as styles from './screenshot-details-window.module.scss';

const vanillaParadoxModsSrc = 'Media/Glyphs/ParadoxMods.svg';

const vanillaCheckmarkSrc = 'Media/Glyphs/Checkmark.svg';

/**
 * Every icon the window's empty states can show, preloaded while it is open rather than with the
 * controls, so they cost nothing until the window is used.
 * Each tab still draws its icon blank the first time it shows before the icon has landed.
 */
const preloadedIcons: readonly string[] = [
  penLineDuotoneLightSrc,
  apertureDuotoneLightSrc,
  vanillaParadoxModsSrc,
  vanillaCheckmarkSrc
];

/**
 * The window holding everything known about a screenshot, a modal built from the same parts as the
 * game's own large windows: a title band, a tab bar under it, and a body over a dimmed backdrop.
 *
 * It stays mounted while closed, so the transition group it holds can play the game's panel
 * transition both ways, keeping a closing window on screen until its exit has played.
 */
export const ScreenshotDetailsWindow = memo(
  ({
    screenshot,
    openTab,
    from,
    onClose
  }: Readonly<{
    screenshot: Screenshot;
    /**
     * The tab the window opens on, `undefined` while it is closed.
     */
    openTab: DetailsTabId | undefined;
    /**
     * Where the window is opened from, which its usage events report.
     */
    from: 'menu' | 'dashboard';
    onClose: () => void;
  }>): ReactElement => {
    const isOpen = openTab != undefined;

    // On the closed-to-open transition, rather than on the modal's mount: a window reopened while
    // its exit plays keeps the modal it had.
    useEffect(() => {
      if (isOpen) {
        bindings.trackUsage('screenshot_details_opened', { from });
      }
    }, [isOpen, from]);

    return (
      <ModalHost>
        {openTab != undefined && (
          <DetailsModal
            key='details'
            screenshot={screenshot}
            initialTab={openTab}
            onClose={onClose}
          />
        )}
      </ModalHost>
    );
  }
);

function DetailsModal({
  screenshot,
  initialTab,
  onClose
}: Readonly<{
  screenshot: Screenshot;
  initialTab: DetailsTabId;
  onClose: () => void;
}>): ReactElement {
  const translate = useTranslate();

  const gameLocale = bindings.useLocale();

  const modSettings = bindings.useModSettings();

  const details = selectScreenshotDetails(screenshot, useDetailsContext());

  const viewerModIds = useViewerModIds();

  // Read afresh each time the window opens: the modal mounts on each opening.
  useEffect(() => {
    bindings.readViewerPlayset();
  }, []);

  // The playset's toggles, forgotten when the screenshot changes: the next screenshot's playset is
  // another list, and a filter emptying it would only fall back.
  const [filterState, setFilterState] = useState<{
    screenshotId: string;
    filter: PlaysetFilter;
  }>();

  const filter =
    filterState?.screenshotId == screenshot.id ? filterState.filter : defaultPlaysetFilter;

  // A toggle changes its own part of the filter as chosen: a kind the missing-only toggle emptied
  // falls back to All in the view, and comes back once that toggle is off.
  const changeFilter = (change: Partial<PlaysetFilter>): void => {
    setFilterState({ screenshotId: screenshot.id, filter: { ...filter, ...change } });
  };

  // Recomputed on each render, rare and cheap: one pass over the list per toggle.
  const playsetTab: PlaysetTabProps =
    details.playset.kind == 'content'
      ? { kind: 'content', view: selectPlaysetView(details.playset.mods, viewerModIds, filter) }
      : details.playset;

  const playsetView = playsetTab.kind == 'content' ? playsetTab.view : undefined;

  // The same form of the name the controls show, or the native one when that form is missing.
  const city = selectLocalizedName(modSettings.namesTranslationMode, gameLocale, {
    value: screenshot.cityName,
    latinized: screenshot.cityNameLatinized,
    translated: screenshot.cityNameTranslated,
    locale: screenshot.cityNameLocale
  });

  // Not kept across openings: the window reopens on the tab it is opened on.
  const [selectedTab, setSelectedTab] = useState(initialTab);

  // The tab last tracked, so that the tab the window opens on is not tracked as a change.
  const trackedTabRef = useRef(initialTab);

  useEffect(() => {
    if (selectedTab != trackedTabRef.current) {
      trackedTabRef.current = selectedTab;

      bindings.trackUsage('screenshot_details_tab_changed', { tab: selectedTab });
    }
  }, [selectedTab]);

  // Switch Tab is handled here rather than by the vanilla tab bar, which waits for the focus the
  // way Back would. It wraps around at either end.
  const actions = useMemo(
    () => ({
      'Back': onClose,
      'Switch Tab': (direction: number) => {
        if (direction == 0) {
          return;
        }

        // From the state rather than the render: the input stack keeps this handler until its
        // next rebuild, which a second press can beat.
        setSelectedTab(currentTab => {
          const index = detailsTabs.findIndex(tab => tab.id == currentTab);
          const count = detailsTabs.length;

          return detailsTabs[(index + (direction < 0 ? count - 1 : 1)) % count]?.id ?? currentTab;
        });

        bindings.playSound(direction < 0 ? 'select-previous-item' : 'select-next-item');
      }
    }),
    [onClose, setSelectedTab]
  );

  // The playset's list states, the toolbox standing above them all.
  const isListShown = selectedTab == 'playset' && isPlaysetToolboxShown(playsetTab);

  // The labels head rows: a list the toggles emptied shows its statement under the toolbox alone.
  const areColumnsShown =
    isListShown && (playsetTab.kind != 'content' || playsetTab.view.rows.length > 0);

  // Only on the playset tab: elsewhere a playset landing meanwhile would remount the tab shown.
  const playsetFilterKey =
    selectedTab == 'playset' && playsetView ? Object.values(playsetView.filter).join('-') : '';

  return (
    <ModalBackdrop actions={actions} onClose={onClose}>
      <Panel
        className={styles.window}
        theme={iceflakePanelTheme}
        header={
          <>
            <PanelTitleBar>{city.name ?? screenshot.cityName}</PanelTitleBar>

            <TabBar className={styles.tabBar}>
              {detailsTabs.map(tab => (
                <Tab
                  key={tab.id}
                  id={tab.id}
                  selectedId={selectedTab}
                  className={styles.tab}
                  onSelect={setSelectedTab}>
                  <Icon
                    src={tab.iconSrc}
                    tinted={true}
                    className={classNames(styles.tabIcon, tab.iconClassName)}
                  />
                  <span className={styles.tabLabel}>{translate(tab.labelId)}</span>
                </Tab>
              ))}
            </TabBar>
          </>
        }
        onClose={onClose}>
        <PreloadImages srcs={preloadedIcons} />

        {/*
            The panel's content hosts a single focusable child: this scope holds the toolbox's
            buttons along with the list's own scope.
          */}
        <AutoNavigationScope>
          {/*
              Above the body's scrolling content, so the toolbox and the labels stay as the list
              scrolls.
            */}
          {isListShown && (
            <>
              <PlaysetToolbox
                view={playsetView}
                hasViewerPlayset={viewerModIds != undefined}
                onChange={changeFilter}
              />

              {areColumnsShown && <PlaysetColumns />}
            </>
          )}

          {/*
              Keyed on the screenshot, the tab and the playset's filter, so each starts scrolled to
              its top.
              The scrollbar's room is reserved, as it otherwise comes two frames after the content
              and rewraps it.
            */}
          <Scrollable
            key={`${screenshot.id}-${selectedTab}-${playsetFilterKey}`}
            className={classNames(styles.windowContent, isListShown && styles.windowContentList)}
            trackVisibility='reserve'>
            {selectedTab == 'description' && <DescriptionTab state={details.description} />}

            {selectedTab == 'photoModeSettings' && (
              <PhotoModeSettingsTab state={details.photoModeSettings} />
            )}

            {selectedTab == 'playset' && (
              <PlaysetTab
                screenshotId={screenshot.id}
                state={playsetTab}
                shouldLoad={details.shouldLoadPlayset}
              />
            )}
          </Scrollable>
        </AutoNavigationScope>
      </Panel>
    </ModalBackdrop>
  );
}

function DescriptionTab({ state }: Readonly<{ state: DetailsTabState }>): ReactElement {
  const translate = useTranslate();

  // Built here rather than at module scope, so a missing game export costs this tab rather than the
  // whole mod UI.
  const renderer = useMemo(() => new MarkdownRenderer(), []);

  switch (state.kind) {
    case 'content': {
      return (
        <FormattedParagraphs
          className={styles.windowParagraphs}
          renderer={renderer}
          theme={descriptionTheme}>
          {state.text}
        </FormattedParagraphs>
      );
    }
    case 'notShared': {
      return (
        <EmptyState iconSrc={penLineDuotoneLightSrc}>
          {translate('HallOfFame.UI.Menu.ScreenshotDetails.DESCRIPTION[Not Shared]')}
        </EmptyState>
      );
    }
    case 'predatesFeature': {
      return (
        <EmptyState iconSrc={penLineDuotoneLightSrc}>
          {translate('HallOfFame.UI.Menu.ScreenshotDetails.DESCRIPTION[Predates Feature]')}
        </EmptyState>
      );
    }
    default: {
      // oxlint-disable-next-line typescript/only-throw-error
      throw state satisfies never;
    }
  }
}

function PhotoModeSettingsTab({ state }: Readonly<{ state: PhotoModeTabState }>): ReactElement {
  const translate = useTranslate();

  switch (state.kind) {
    case 'content': {
      return (
        <div className={styles.photoMode}>
          <p className={styles.photoModeNotice}>
            {translate('HallOfFame.UI.Menu.ScreenshotDetails.PHOTO_MODE_SETTINGS[Notice]')}
          </p>

          {state.conditions && <ConditionsBlock conditions={state.conditions} />}

          {state.groups.map(group => (
            <section key={group.id ?? ''} className={styles.photoModeGroup}>
              <h2 className={styles.photoModeGroupTitle}>
                {group.id == undefined
                  ? translate('HallOfFame.UI.Menu.ScreenshotDetails.PHOTO_MODE_SETTINGS[Other]')
                  : translate(`PhotoMode.TAB[${group.id}]`, group.id)}
              </h2>

              {group.sections.map(section => (
                <PhotoModeSectionView key={section.id ?? ''} section={section} />
              ))}
            </section>
          ))}
        </div>
      );
    }
    case 'notShared': {
      return (
        <EmptyState iconSrc={apertureDuotoneLightSrc}>
          {state.isViewerCreator
            ? translate(
                'HallOfFame.UI.Menu.ScreenshotDetails.PHOTO_MODE_SETTINGS[Not Shared By You]'
              )
            : translate('HallOfFame.UI.Menu.ScreenshotDetails.PHOTO_MODE_SETTINGS[Not Shared]')}
        </EmptyState>
      );
    }
    case 'predatesFeature': {
      return (
        <EmptyState iconSrc={apertureDuotoneLightSrc}>
          {translate('HallOfFame.UI.Menu.ScreenshotDetails.PHOTO_MODE_SETTINGS[Predates Feature]')}
        </EmptyState>
      );
    }
    case 'sharedEmpty': {
      return (
        <>
          {state.conditions && (
            <div className={styles.photoMode}>
              <ConditionsBlock conditions={state.conditions} />
            </div>
          )}

          <EmptyState iconSrc={apertureDuotoneLightSrc}>
            {translate(
              'HallOfFame.UI.Menu.ScreenshotDetails.PHOTO_MODE_SETTINGS[Default Settings]'
            )}
          </EmptyState>
        </>
      );
    }
    default: {
      // oxlint-disable-next-line typescript/only-throw-error
      throw state satisfies never;
    }
  }
}

/**
 * The scene and the light the shot was taken in: a summary led by the weather icon of the game's
 * climate widget, then the values the game chose, named and laid out as the settings overriding
 * them.
 */
function ConditionsBlock({
  conditions
}: Readonly<{ conditions: PhotoModeConditions }>): ReactElement {
  const translate = useTranslate();

  const { time, season, weather, isNight, temperature, sunElevation, gameChosen, isRecorded } =
    conditions;

  const headline = [
    season != undefined && translate(`Climate.SEASON[${season}]`, season),
    weather != undefined &&
      translate(`HallOfFame.UI.Menu.ScreenshotDetails.CONDITIONS[Weather ${weather}]`),
    temperature != undefined && (
      <LocalizedNumber key='temperature' value={temperature} unit={Unit.Temperature} />
    )
  ];

  const details = [
    time?.kind == 'clock' && formatClockTime(time.hour),
    time?.kind == 'clock' && time.latitude != undefined && (
      <LocalizedString
        key='latitude'
        id={
          time.latitude < 0
            ? 'HallOfFame.UI.Menu.ScreenshotDetails.CONDITIONS[Latitude South]'
            : 'HallOfFame.UI.Menu.ScreenshotDetails.CONDITIONS[Latitude North]'
        }
        args={{ ANGLE: formatConditionsAngle(Math.abs(time.latitude), translate) }}
      />
    ),
    sunElevation != undefined && (
      <LocalizedString
        key='sunElevation'
        id='HallOfFame.UI.Menu.ScreenshotDetails.CONDITIONS[Sun Elevation]'
        args={{ ANGLE: formatConditionsAngle(sunElevation, translate) }}
      />
    )
  ];

  return (
    <section className={styles.photoModeGroup}>
      <h2 className={styles.photoModeGroupTitle}>
        {translate('HallOfFame.UI.Menu.ScreenshotDetails.CONDITIONS[Title]')}
      </h2>

      <div className={styles.conditionsSummary}>
        {weather != undefined && <ConditionsIcon weather={weather} isNight={isNight} />}

        <div>
          <ConditionsLine className={styles.conditionsHeadline}>{headline}</ConditionsLine>
          <ConditionsLine className={styles.conditionsDetails}>{details}</ConditionsLine>
        </div>
      </div>

      {!isRecorded && (
        <p className={styles.photoModeNote}>
          {translate('HallOfFame.UI.Menu.ScreenshotDetails.CONDITIONS[Not Recorded]')}
        </p>
      )}

      {time?.kind == 'dayNightVisualsOff' && (
        <p className={styles.photoModeNote}>
          {translate('HallOfFame.UI.Menu.ScreenshotDetails.CONDITIONS[Day Night Visuals Off]')}
        </p>
      )}

      {gameChosen.length > 0 && (
        <PhotoModeSectionTitle>
          <div className={classNames(photoModeContainerClasses.title, sectionTitleClassName())}>
            {translate('HallOfFame.UI.Menu.ScreenshotDetails.CONDITIONS[Game Chosen]')}
          </div>
        </PhotoModeSectionTitle>
      )}

      {gameChosen.map((setting, index) => (
        <PhotoModeSettingRow key={setting.code} setting={setting} index={index} />
      ))}
    </section>
  );
}

/**
 * An angle's number alone, to one decimal, its degree sign left to the string around it: the
 * game's own angle unit spaces the sign off (`45.8 °`), which jars beside the temperature's `11°C`
 * on the line above.
 * A string rather than a `LocalizedNumber`, which only the game's own units render as a
 * `LocalizedString` argument, formatted as the game formats a number: a whole value without its
 * fraction, the game's decimal separator otherwise.
 * Through `Number`, so a tiny negative, which rounds to `-0.0`, reads `0`.
 */
function formatConditionsAngle(value: number, translate: Localization['translate']): string {
  return String(Number(value.toFixed(1))).replace(
    '.',
    translate('Common.DECIMAL_SEPARATOR', '.') ?? '.'
  );
}

function ConditionsIcon({
  weather,
  isNight
}: Readonly<{ weather: PhotoModeWeather; isNight: boolean | undefined }>): ReactElement {
  return (
    <div className={styles.conditionsIcon}>
      {/* As the game's climate widget: clouds beyond a few hide the sun or the moon. */}
      {(weather == 'Clear' || weather == 'Few') && (
        <img
          src={isNight ? 'Media/Game/Climate/Moon.svg' : 'Media/Game/Climate/Sun.svg'}
          className={isNight ? styles.conditionsMoon : styles.conditionsSun}
        />
      )}
      {weather != 'Clear' && (
        <img src={`Media/Game/Climate/${weather}.svg`} className={styles.conditionsWeather} />
      )}
    </div>
  );
}

/**
 * The known items of a summary line, separated by dots, nothing when none is known.
 * Each item has a span of its own: Cohtml lays out a div's children as a column.
 */
function ConditionsLine({
  className,
  children
}: Readonly<{ className: string; children: readonly ReactNode[] }>): ReactNode {
  const items = children.filter(Boolean);

  return (
    items.length > 0 && (
      <div className={className}>
        {items.map((item, index) => (
          // oxlint-disable-next-line react/no-array-index-key - fixed items, never reordered
          <span key={index}>
            {/* oxlint-disable-next-line react/jsx-no-literals - typographic symbol, not translatable */}
            {index > 0 && <span className={styles.conditionsSeparator}>·</span>}
            {item}
          </span>
        ))}
      </div>
    )
  );
}

/**
 * A section's title and settings, as the game's photo mode panel lays them out.
 */
function PhotoModeSectionView({ section }: Readonly<{ section: PhotoModeSection }>): ReactElement {
  return (
    <div>
      {section.id != undefined && (
        <PhotoModeSectionTitle>
          <PhotoModeTitle code={section.id} className={sectionTitleClassName()} />
        </PhotoModeSectionTitle>
      )}

      {section.settings.map((setting, index) => (
        <PhotoModeSettingRow key={setting.code} setting={setting} index={index} />
      ))}
    </div>
  );
}

/**
 * A setting as the game's photo mode panel names and lays it out, every other one of a section
 * banded, and the mod's note on it under the row.
 */
function PhotoModeSettingRow({
  setting,
  index
}: Readonly<{ setting: PhotoModeSetting; index: number }>): ReactElement {
  const translate = useTranslate();

  const isBanded = index % 2 == 1;

  return (
    <>
      {/* Active, as the panel marks a setting switched on: it dims the name of one that is not. */}
      <div
        className={classNames(
          photoModeContainerClasses.container,
          photoModeContainerClasses.active,
          styles.photoModeSetting,
          index > 0 && styles.photoModeSettingFollowing,
          isBanded && styles.photoModeSettingAlternate
        )}>
        <div className={classNames(photoModeContainerClasses.children, styles.photoModeRow)}>
          <PhotoModeTitle code={setting.code} className={styles.photoModeRowName} />
          <div className={styles.photoModeRowValue}>
            <PhotoModeValueView setting={setting} />
          </div>
        </div>
      </div>

      {setting.noteId != undefined && (
        <p className={classNames(styles.photoModeNote, isBanded && styles.photoModeNoteBanded)}>
          {translate(setting.noteId)}
        </p>
      )}
    </>
  );
}

/**
 * A section title's row as the game's photo mode panel lays it out, around a title element wearing
 * the section title's classes, {@link sectionTitleClassName}.
 */
function PhotoModeSectionTitle({ children }: Readonly<{ children: ReactNode }>): ReactElement {
  return (
    <div
      className={classNames(
        photoModeContainerClasses.container,
        photoModeContainerClasses.group,
        styles.photoModeSectionRow
      )}>
      <div className={photoModeContainerClasses.children}>{children}</div>
    </div>
  );
}

/**
 * The classes of a section title's name, which go on the panel's title element itself: they
 * override its dimmed color.
 */
function sectionTitleClassName(): string {
  return classNames(photoModeContainerClasses.groupTitle, styles.photoModeSectionTitle);
}

/**
 * A photo mode property's or section's name with the game's tooltip for it, the way the game's
 * photo mode panel shows it: on the name alone, the name over the description, opening away from
 * the values.
 */
function PhotoModeTitle({
  code,
  className
}: Readonly<{ code: string; className: string }>): ReactElement {
  const translate = useTranslate();

  const name = translate(`PhotoMode.PROPERTY_TITLE[${code}]`, code);

  // No tooltip for a property the game has no text for: the game's own would only repeat the
  // name, or show the raw code.
  const description = translate(`PhotoMode.PROPERTY_TOOLTIP[${code}]`, '');

  return (
    <Tooltip
      direction='left'
      alignment='start'
      tooltip={description ? <TooltipLayout title={name} description={description} /> : undefined}>
      <div className={classNames(photoModeContainerClasses.title, className)}>{name}</div>
    </Tooltip>
  );
}

function PhotoModeValueView({
  setting: { code, value }
}: Readonly<{ setting: PhotoModeSetting }>): ReactNode {
  const translate = useTranslate();

  switch (value.kind) {
    case 'number': {
      return formatPhotoModeNumber(value.value, value.fractionDigits);
    }
    case 'enum': {
      return value.option == undefined
        ? String(value.value)
        : translate(`PhotoMode.${value.enumType.toUpperCase()}[${value.option}]`, value.option);
    }
    case 'checkbox': {
      return value.isOn
        ? translate('HallOfFame.UI.Menu.ScreenshotDetails.PHOTO_MODE_SETTINGS[On]')
        : translate('HallOfFame.UI.Menu.ScreenshotDetails.PHOTO_MODE_SETTINGS[Off]');
    }
    case 'color': {
      const channels = [value.red, value.green, value.blue].map(channel =>
        Math.round(Math.min(Math.max(channel, 0), 1) * MAX_CSS_CHANNEL)
      );

      const sliders = toPhotoModeColorSliders(value);

      // The letters are the picker's own labels, which the game does not localize.
      const components = [
        { name: 'H', value: sliders.hue },
        { name: 'S', value: sliders.saturation },
        { name: 'V', value: sliders.value },
        ...(sliders.alpha == undefined ? [] : [{ name: 'A', value: sliders.alpha }])
      ];

      return (
        <>
          <div
            className={styles.photoModeSwatch}
            style={{ backgroundColor: `rgba(${channels.join(', ')}, ${value.alpha ?? 1})` }}
          />

          {components.map(component => (
            <PhotoModeComponentView key={component.name} {...component} />
          ))}
        </>
      );
    }
    case 'vector': {
      return value.components.map(component => (
        <PhotoModeComponentView
          key={component.name}
          name={translate(`PhotoMode.PROPERTY_TITLE[${code}/${component.name}]`, component.name)}
          value={formatPhotoModeNumber(component.value, value.fractionDigits)}
        />
      ));
    }
    default: {
      // oxlint-disable-next-line typescript/only-throw-error
      throw value satisfies never;
    }
  }
}

function PhotoModeComponentView({
  name,
  value
}: Readonly<{ name: ReactNode; value: ReactNode }>): ReactElement {
  return (
    <span className={styles.photoModeComponent}>
      <span className={styles.photoModeComponentName}>{name}</span>
      <span>{value}</span>
    </span>
  );
}

/**
 * A number as the game's photo mode fields write it, so a player can type it back in as read;
 * `undefined` fraction digits keep it as stored.
 * Negative fraction digits, which a mod can set, read as none, as the game shows an integer field.
 */
function formatPhotoModeNumber(value: number, fractionDigits: number | undefined): string {
  return fractionDigits == undefined ? String(value) : value.toFixed(Math.max(fractionDigits, 0));
}

const MAX_CSS_CHANNEL = 255;

/**
 * The tab's state as the window hands it down: the loaded list replaced by what the toolbox's
 * filter selects of it.
 */
type PlaysetTabProps =
  | Exclude<PlaysetTabState, { kind: 'content' }>
  | { readonly kind: 'content'; readonly view: PlaysetView };

/**
 * The creator's playset, asked for when the tab opens: the mod answers at once with one it already
 * holds.
 */
function PlaysetTab({
  screenshotId,
  state,
  shouldLoad
}: Readonly<{
  screenshotId: string;
  state: PlaysetTabProps;
  shouldLoad: boolean;
}>): ReactElement {
  const translate = useTranslate();

  // The scroller's key carries the filter on the playset tab, so a toggle remounts this tab and
  // sends the request again: the loader answers a loaded playset from memory with an equal record,
  // which the binding does not publish again.
  useEffect(() => {
    if (shouldLoad) {
      bindings.loadPlayset(screenshotId);
    }
  }, [screenshotId, shouldLoad]);

  switch (state.kind) {
    case 'loading': {
      return (
        <PlaysetList
          count={state.placeholderCount}
          renderRow={index => <PlaysetPlaceholderRow key={index} index={index} />}
        />
      );
    }
    case 'failed': {
      return (
        <EmptyState
          iconSrc={vanillaParadoxModsSrc}
          action={
            <Button
              variant='primary'
              className={styles.emptyStateAction}
              onSelect={() => bindings.loadPlayset(screenshotId)}>
              {translate('HallOfFame.UI.Menu.MenuControls.ACTION[Retry]')}
            </Button>
          }>
          {translate('HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET[Load Error]')}
        </EmptyState>
      );
    }
    case 'content': {
      const { rows } = state.view;

      // Only the missing-only toggle empties a loaded list: the other toggles fall back.
      if (state.view.filter.isMissingOnly && rows.length == 0) {
        return (
          <EmptyState iconSrc={vanillaCheckmarkSrc}>
            {translate('HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET[All Owned]')}
          </EmptyState>
        );
      }

      return (
        <PlaysetList
          count={rows.length}
          renderRow={index => {
            const row = rows[index];

            // Keyed on the mod, so a row scrolled from one slot to the next keeps its element, and
            // with it the thumbnail it already loaded.
            return (
              row && (
                <PlaysetModRow key={row.mod.id} mod={row.mod} isOwned={row.isOwned} index={index} />
              )
            );
          }}
        />
      );
    }
    case 'notShared': {
      return (
        <EmptyState iconSrc={vanillaParadoxModsSrc}>
          {state.isViewerCreator
            ? translate('HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET[Not Shared By You]')
            : translate('HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET[Not Shared]')}
        </EmptyState>
      );
    }
    case 'predatesFeature': {
      return (
        <EmptyState iconSrc={vanillaParadoxModsSrc}>
          {translate('HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET[Predates Feature]')}
        </EmptyState>
      );
    }
    case 'sharedEmpty': {
      return (
        <EmptyState iconSrc={vanillaParadoxModsSrc}>
          {state.reason == 'notRecorded'
            ? translate('HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET[Not Recorded]')
            : translate('HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET[None Available]')}
        </EmptyState>
      );
    }
    default: {
      // oxlint-disable-next-line typescript/only-throw-error
      throw state satisfies never;
    }
  }
}

/**
 * The playset's rows in the game's virtual list, only those in view built: a playset runs to
 * hundreds of mods, each row a remote thumbnail.
 * It scrolls inside the window's own body, bounded by the window's height from the first frame.
 */
function PlaysetList({
  count,
  renderRow
}: Readonly<{
  count: number;
  renderRow: (index: number) => ReactNode;
}>): ReactElement {
  const { anchorRef, list } = useUniformVirtualList({
    count,
    overscan: PLAYSET_OVERSCAN,
    rowSelector: PLAYSET_ROW_SELECTOR,
    estimatedRowHeightPx: ESTIMATED_ROW_HEIGHT_PX,
    className: styles.playset,
    renderRow
  });

  return (
    <>
      {/* In the body's `Scrollable`, which is the window's. */}
      <div ref={anchorRef} />

      {/* The rows' own focus scope: the panel's content hosts a single focusable child. */}
      <AutoNavigationScope>{list}</AutoNavigationScope>
    </>
  );
}

// Every row of the list, placeholders included: their class names are hashed.
const PLAYSET_ROW_SELECTOR = '[data-playset-row]';

/**
 * Rows kept rendered past each edge of the viewport, low as each is a thumbnail fetched from the
 * CDN.
 */
const PLAYSET_OVERSCAN = 3;

/**
 * What the first frames assume a row measures, before a rendered one is measured: the row's height
 * at the resolution where a `rem` is a pixel.
 */
const ESTIMATED_ROW_HEIGHT_PX = 52;

/**
 * The toggles narrowing the playset and the comparison with the viewer's own, in the look of the
 * game's tool options: a row per group, its label then its buttons.
 * Without a view, while the playset loads or failed to, it stands disabled where it will be, so
 * the window keeps its shape.
 */
function PlaysetToolbox({
  view,
  hasViewerPlayset,
  onChange
}: Readonly<{
  view: PlaysetView | undefined;
  hasViewerPlayset: boolean;
  onChange: (change: Partial<PlaysetFilter>) => void;
}>): ReactElement {
  const translate = useTranslate();

  const isDisabled = view == undefined;

  // The default stands in while the playset loads or failed to, before any toggle could be chosen:
  // a loaded playset is kept and never loads again.
  const filter = view?.filter ?? defaultPlaysetFilter;

  const kinds = view?.kinds ?? [{ id: 'all', count: undefined }];

  return (
    <div className={styles.toolbox}>
      <div className={styles.toolboxRow}>
        <div className={styles.toolboxLabel}>
          {translate('HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET[Kind Row]')}
        </div>

        <div className={styles.toolboxToggles} data-toolbox-row='kind'>
          {kinds.map(toggle => (
            <PlaysetToggleButton
              key={toggle.id}
              labelId={playsetKindLabelIds[toggle.id]}
              count={toggle.count}
              isSelected={toggle.id == filter.kind}
              isDisabled={isDisabled}
              onSelect={() => onChange({ kind: toggle.id, category: 'all' })}
            />
          ))}
        </div>
      </div>

      {view?.categories && (
        <div className={styles.toolboxRow}>
          <div className={styles.toolboxLabel}>
            {translate('HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET[Category Row]')}
          </div>

          <div className={styles.toolboxToggles} data-toolbox-row='category'>
            {view.categories.map(toggle => (
              <PlaysetToggleButton
                key={toggle.id}
                labelId={assetCategoryLabelIds[toggle.id]}
                count={toggle.count}
                isSelected={toggle.id == filter.category}
                isDisabled={false}
                isSecondary={true}
                onSelect={() => onChange({ category: toggle.id })}
              />
            ))}
          </div>
        </div>
      )}

      {/* Mounts once the viewer's read lands, and unmounts if a later read fails: keeping its place
          would need the binding to tell a read not yet answered from a failed one. */}
      {hasViewerPlayset && (
        <div className={styles.toolboxRow}>
          <div className={styles.toolboxLabel}>
            {translate('HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET[Viewer Row]')}
          </div>

          <div className={styles.toolboxOverlap}>
            {/* The string has no plural: a one-mod playset reads "1 of these 1 mods". */}
            {view?.overlap ? (
              <LocalizedString
                id='HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET[Overlap]'
                args={{
                  OWNED: <LocalizedNumber value={view.overlap.owned} />,
                  TOTAL: <LocalizedNumber value={view.overlap.total} />
                }}
              />
            ) : (
              <div className={styles.toolboxOverlapPlaceholder} />
            )}
          </div>

          <div
            className={classNames(
              styles.toolboxCheckbox,
              isDisabled && styles.toolboxCheckboxDisabled
            )}
            onClick={() => {
              if (isDisabled) {
                return;
              }

              onChange({ isMissingOnly: !filter.isMissingOnly });
              bindings.playSound('select-toggle');
            }}>
            <Checkbox theme={checkboxTheme} checked={filter.isMissingOnly} disabled={isDisabled} />

            <label className={styles.toolboxCheckboxLabel}>
              {translate('HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET[Missing Only]')}
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * One of the toolbox's buttons, its label then how many mods it holds, the count unknown while
 * the playset loads.
 */
function PlaysetToggleButton({
  labelId,
  count,
  isSelected,
  isDisabled,
  isSecondary = false,
  onSelect
}: Readonly<{
  labelId: string;
  count: number | undefined;
  isSelected: boolean;
  isDisabled: boolean;
  // A category, drawn one step smaller than the kinds.
  isSecondary?: boolean;
  onSelect: () => void;
}>): ReactElement {
  const translate = useTranslate();

  return (
    <Button
      theme={toggleButtonTheme}
      className={classNames(
        isSelected && styles.toggleSelected,
        isSecondary && styles.toggleSecondary
      )}
      selected={isSelected}
      disabled={isDisabled}
      onSelect={onSelect}
      data-selected={isSelected}>
      <span>{translate(labelId)}</span>

      {count != undefined && <span className={styles.toggleCount}>{count}</span>}
    </Button>
  );
}

const toggleButtonTheme = { button: styles.toggle };

const checkboxTheme: CheckboxTheme = getClassesModule(
  'game-ui/common/input/toggle/checkbox/checkbox.module.scss',
  ['toggle', 'checkmark']
);

const playsetKindLabelIds: Readonly<Record<PlaysetKind, string>> = {
  all: 'HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET_KIND[All]',
  codeMods: 'HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET_KIND[Code Mods]',
  assets: 'HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET_KIND[Assets]',
  maps: 'HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET_KIND[Maps]'
};

const assetCategoryLabelIds: Readonly<Record<AssetCategory, string>> = {
  all: 'HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET_CATEGORY[All]',
  buildings: 'HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET_CATEGORY[Buildings]',
  props: 'HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET_CATEGORY[Props]',
  vehicles: 'HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET_CATEGORY[Vehicles]',
  roads: 'HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET_CATEGORY[Roads]',
  vegetation: 'HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET_CATEGORY[Vegetation]',
  surfaces: 'HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET_CATEGORY[Surfaces]',
  creatures: 'HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET_CATEGORY[Creatures]',
  assetPacks: 'HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET_CATEGORY[Asset Packs]'
};

/**
 * The labels over the playset's columns, lined up with a row's cells.
 */
function PlaysetColumns(): ReactElement {
  const translate = useTranslate();

  return (
    <div className={styles.playsetColumns}>
      <Tooltip
        direction='down'
        tooltip={
          <TooltipLayout
            title={translate('HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET[Skyve Column]')}
            description={translate(
              'HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET[Skyve Column Tooltip]'
            )}
          />
        }>
        <div className={classNames(styles.playsetColumnsLabel, styles.playsetColumnsLabelSkyve)}>
          <SkyveLogo />
          {translate('HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET[Skyve Column]')}
        </div>
      </Tooltip>

      <div className={classNames(styles.playsetColumnsLabel, styles.playsetColumnsLabelRelease)}>
        {translate('HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET[Updated Column]')}
      </div>

      <div className={classNames(styles.playsetColumnsLabel, styles.playsetColumnsLabelSize)}>
        {translate('HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET[Size Column]')}
      </div>

      <div
        className={classNames(styles.playsetColumnsLabel, styles.playsetColumnsLabelSubscribers)}>
        {translate('HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET[Subscribers Column]')}
      </div>
    </div>
  );
}

/**
 * A mod of the playset, opening its Paradox Mods page, its short description, Skyve's verdict and
 * the game version it was made for in a tooltip.
 * A mod Paradox Mods no longer publishes is dimmed, the server listing those last.
 */
function PlaysetModRow({
  mod,
  isOwned,
  index
}: Readonly<{
  mod: Mod;
  isOwned: boolean;
  index: number;
}>): ReactElement {
  const translate = useTranslate();

  const gameVersion = bindings.useGameVersion();

  const hints = selectModHints(mod, gameVersion);

  const hasDescription = mod.shortDescription != '';

  const hasHints = hints.skyve != undefined || hints.gameVersion != undefined;

  const hasPreviews = mod.previewUrls.length > 0;

  const hasContent = hasPreviews || hasHints;

  return (
    <Tooltip
      direction='right'
      tooltip={
        hasDescription || hasContent ? (
          <TooltipLayout
            title={mod.name}
            description={hasDescription ? mod.shortDescription : undefined}
            content={
              hasContent ? (
                <>
                  {hasPreviews && <PlaysetPreview urls={mod.previewUrls} />}

                  {hasHints && <PlaysetModRowTooltipContent hints={hints} />}
                </>
              ) : undefined
            }
          />
        ) : undefined
      }>
      {/* The tooltip's own host element, which the vanilla button would not lend it. */}
      <div
        className={classNames(
          playsetRowClassName(index),
          mod.state != 'published' && styles.playsetRowUnavailable
        )}
        data-playset-row={true}
        data-is-owned={isOwned}>
        <Button
          theme={playsetRowButtonTheme}
          // Compared by value, so a row keeps its focus across the list's re-renders.
          focusKey={`mod-${mod.id}`}
          onSelect={() => bindings.openModPage(mod, 'details')}>
          <div
            className={styles.playsetRowThumbnail}
            style={{ backgroundImage: `url(${deriveModThumbnailUri(mod.thumbnailUrl)})` }}
          />

          <div className={styles.playsetRowText}>
            <div className={styles.playsetRowNameLine}>
              <div className={styles.playsetRowName}>{mod.name}</div>

              {isOwned && (
                <Icon src={vanillaCheckmarkSrc} tinted={true} className={styles.playsetRowOwned} />
              )}
            </div>
            <div className={styles.playsetRowAuthor}>{mod.authorName}</div>
          </div>

          {/* Every cell rendered, empty or not, so the columns line up from row to row. */}
          <div
            className={classNames(
              styles.playsetRowCell,
              hints.cell && playsetRowCellToneClassNames[hints.cell.tone]
            )}
            data-tone={hints.cell?.tone}>
            {hints.cell && translate(hints.cell.labelId)}
          </div>

          <div className={classNames(styles.playsetRowCell, styles.playsetRowCellRelease)}>
            {mod.knownLastReleasedAtFormattedDistance}
          </div>

          <div className={classNames(styles.playsetRowCell, styles.playsetRowCellSize)}>
            {mod.sizeFormatted}
          </div>

          <div className={styles.playsetRowSubscribers}>
            <Icon src={populationSrc} tinted={true} className={styles.playsetRowSubscribersIcon} />
            <LocalizedNumber value={mod.subscribersCount} unit={Unit.IntegerRounded} />
          </div>
        </Button>
      </div>
    </Tooltip>
  );
}

/**
 * A mod's preview images in a playset row's tooltip, as a 16:9 slot each image fills and crops to,
 * cycling through them while the tooltip stays open.
 * The slot is drawn before the first image arrives, so the tooltip keeps its size while the CDN
 * answers.
 */
function PlaysetPreview({ urls }: Readonly<{ urls: readonly string[] }>): ReactElement {
  const [index, setIndex] = useState(0);

  // The image after the shown one, `undefined` with a single image, which never switches.
  const nextIndex = urls.length > 1 ? (index + 1) % urls.length : undefined;

  const nextUrl = nextIndex == undefined ? undefined : urls[nextIndex];

  useEffect(() => {
    const timer =
      nextIndex == undefined ? undefined : setTimeout(() => setIndex(nextIndex), PREVIEW_CYCLE_MS);

    return () => clearTimeout(timer);
  }, [nextIndex]);

  return (
    <>
      <div
        className={styles.playsetTooltipPreview}
        style={{ backgroundImage: `url(${urls[index] ?? ''})` }}
      />

      {/* Fetched ahead so the switch paints at once instead of blank while the CDN answers. */}
      {nextUrl != undefined && <PreloadImages srcs={[nextUrl]} />}
    </>
  );
}

const PREVIEW_CYCLE_MS = 3000;

/**
 * The lines of a playset row's tooltip under the mod's short description.
 */
function PlaysetModRowTooltipContent({ hints }: Readonly<{ hints: ModHints }>): ReactElement {
  const { skyve, gameVersion } = hints;

  return (
    <div className={styles.playsetTooltip}>
      {skyve && <SkyveVerdictBlock block={skyve} />}

      {gameVersion && (
        <p
          className={classNames(
            styles.playsetTooltipGameVersion,
            gameVersion.isOlder && styles.playsetTooltipGameVersionOlder
          )}>
          <LocalizedString
            id='HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET[Made For Game Version]'
            args={{ VERSION: gameVersion.version }}
          />
        </p>
      )}
    </div>
  );
}

const playsetRowCellToneClassNames: Readonly<Record<ModHintTone, string>> = {
  dimmed: styles.playsetRowCellDimmed,
  warning: styles.playsetRowCellWarning,
  negative: styles.playsetRowCellNegative
};

/**
 * A row's classes, every other one banded by its place in the whole list: a CSS `nth-child` would
 * count the rows the virtual list happens to have built, and flip as it scrolls.
 */
function playsetRowClassName(index: number): string {
  return classNames(styles.playsetRow, index % 2 == 1 && styles.playsetRowAlternate);
}

// Replaces the vanilla button look, which a row does not wear.
const playsetRowButtonTheme = { button: styles.playsetRowButton };

/**
 * A row's shape while the playset loads, one per mod the screenshot lists.
 */
function PlaysetPlaceholderRow({ index }: Readonly<{ index: number }>): ReactElement {
  return (
    <div
      className={classNames(playsetRowClassName(index), styles.playsetRowPlaceholder)}
      data-playset-row={true}
      aria-busy='true'>
      <div className={styles.playsetRowThumbnail} />

      <div className={styles.playsetRowText}>
        <div className={styles.playsetRowPlaceholderLine} />
        <div className={styles.playsetRowPlaceholderLine} />
      </div>
    </div>
  );
}

/**
 * A tab with nothing to show, laid out like the game's own empty panels under the tab's icon, and
 * the action that can change that.
 */
function EmptyState({
  iconSrc,
  action,
  children
}: Readonly<{ iconSrc: string; action?: ReactNode; children: ReactNode }>): ReactElement {
  return (
    <div className={styles.emptyState}>
      <Icon src={iconSrc} tinted={true} className={styles.emptyStateIcon} />
      <p className={styles.emptyStateText}>{children}</p>
      {action}
    </div>
  );
}

export type DetailsTabId = 'description' | 'photoModeSettings' | 'playset';

/**
 * The window's tabs, in display order.
 */
const detailsTabs: ReadonlyArray<{
  readonly id: DetailsTabId;
  readonly labelId: string;
  readonly iconSrc: string;
  readonly iconClassName?: string;
}> = [
  {
    id: 'description',
    labelId: 'HallOfFame.UI.Menu.ScreenshotDetails.TAB[Description]',
    iconSrc: penLineSolidSrc
  },
  {
    id: 'photoModeSettings',
    labelId: 'HallOfFame.UI.Menu.ScreenshotDetails.TAB[Photo Mode Settings]',
    iconSrc: apertureSharpSolidSrc,
    iconClassName: styles.tabIconDisc
  },
  {
    id: 'playset',
    labelId: 'HallOfFame.UI.Menu.ScreenshotDetails.TAB[Playset]',
    iconSrc: paradoxModsSolidSrc,
    iconClassName: styles.tabIconHexagon
  }
];

/**
 * The tabs' icons, for the controls to preload: unlike the empty states' icons, they show on the
 * frame the window opens.
 */
// oxlint-disable-next-line react/only-export-components - no Fast Refresh in a Cohtml bundle
export const detailsTabsPreloadedIcons: readonly string[] = detailsTabs.map(tab => tab.iconSrc);

// Headings keep the game's own styles; paragraphs get room between them.
const descriptionTheme: Partial<FormattedTextTheme> = {
  // oxlint-disable-next-line id-length - the vanilla theme's own key for a plain paragraph
  p: styles.windowText
};
