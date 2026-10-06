import classNames from 'classnames';
import { AutoNavigationScope, InputActionConsumer } from 'cs2/input';
import { LocalizedNumber, LocalizedString, Unit } from 'cs2/l10n';
import {
  Button,
  FormattedParagraphs,
  type FormattedTextTheme,
  Icon,
  MarkdownRenderer,
  Portal,
  Scrollable
} from 'cs2/ui';
import {
  memo,
  type ReactElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import type { Mod, Screenshot } from '../../common';
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
  findScrollableContent,
  useMeasuredRowHeight,
  useTranslate
} from '../../utils';
import * as bindings from '../../utils/bindings';
import {
  TransitionContext,
  TransitionState
} from '../../vanilla-modules/game-ui/common/animations/transition-context';
import { TransitionGroupCoordinator } from '../../vanilla-modules/game-ui/common/animations/transition-group-coordinator';
import { Panel } from '../../vanilla-modules/game-ui/common/panel/panel';
import { PanelBackdrop } from '../../vanilla-modules/game-ui/common/panel/panel-backdrop';
import { PanelTitleBar } from '../../vanilla-modules/game-ui/common/panel/panel-title-bar';
import { iceflakePanelTheme } from '../../vanilla-modules/game-ui/common/panel/themes/iceflake-panel';
import {
  useUniformSizeProvider,
  useVirtualList
} from '../../vanilla-modules/game-ui/common/scrolling/virtual-list/virtual-list';
import { Tab, TabBar } from '../../vanilla-modules/game-ui/common/tabs/tabs';
import { TooltipLayout } from '../../vanilla-modules/game-ui/common/tooltip/description-tooltip/description-tooltip';
import { photoModeContainerClasses } from '../../vanilla-modules/game-ui/game/components/photo-mode/widgets/photo-mode-container';
import {
  type DetailsTabState,
  formatClockTime,
  isOlderGameVersion,
  type PhotoModeConditions,
  type PhotoModeWeather,
  type PhotoModeSection,
  type PhotoModeSetting,
  type PhotoModeTabState,
  type PlaysetTabState,
  selectScreenshotDetails,
  toPhotoModeColorSliders
} from './screenshot-details';
import { selectLocalizedName } from './select-localized-name';
import { useDetailsContext } from './use-details-context';
import * as styles from './screenshot-details-window.module.scss';

const vanillaParadoxModsSrc = 'Media/Glyphs/ParadoxMods.svg';

/**
 * Every icon the window's empty states can show, preloaded while it is open rather than with the
 * controls, so they cost nothing until the window is used.
 * Each tab still draws its icon blank the first time it shows before the icon has landed.
 */
const preloadedIcons: readonly string[] = [
  penLineDuotoneLightSrc,
  apertureDuotoneLightSrc,
  vanillaParadoxModsSrc
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
    onClose
  }: Readonly<{
    screenshot: Screenshot;
    /**
     * The tab the window opens on, `undefined` while it is closed.
     */
    openTab: DetailsTabId | undefined;
    onClose: () => void;
  }>): ReactElement => (
    <Portal>
      {/*
        The window's own transition group. The panel registers with it rather than with the main
        menu's, which would file the panel under the menu screen's key and drop the menu screen
        along with the closing window.
      */}
      <TransitionGroupCoordinator>
        {openTab != undefined && (
          <DetailsModal
            key='details'
            screenshot={screenshot}
            initialTab={openTab}
            onClose={onClose}
          />
        )}
      </TransitionGroupCoordinator>
    </Portal>
  )
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

  // The same form of the name the controls show, or the native one when that form is missing.
  const city = selectLocalizedName(modSettings.namesTranslationMode, gameLocale, {
    value: screenshot.cityName,
    latinized: screenshot.cityNameLatinized,
    translated: screenshot.cityNameTranslated,
    locale: screenshot.cityNameLocale
  });

  // Not kept across openings: the window reopens on the tab it is opened on.
  const [selectedTab, setSelectedTab] = useState(initialTab);

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
    [onClose]
  );

  // The backdrop fades out alongside the panel's exit, which the transition group drives.
  const isExiting = useContext(TransitionContext).state == TransitionState.exit;

  return (
    // The slideshow controls sit outside the focus path Back travels along, so a consumer waiting
    // for focus would never hear it: this one listens whatever holds the focus.
    <InputActionConsumer actions={actions} ignoreFocusState={true}>
      <PanelBackdrop
        className={classNames(styles.backdrop, isExiting && styles.backdropExiting)}
        onMouseDown={onClose}>
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

          {/* Above the body's scrolling content, so the labels stay as the list scrolls. */}
          {selectedTab == 'playset' && details.playset.kind == 'content' && <PlaysetColumns />}

          {/*
            Keyed on the screenshot and the tab, so each starts scrolled to its top.
            The scrollbar's room is reserved, as it otherwise comes two frames after the content
            and rewraps it.
          */}
          <Scrollable
            key={`${screenshot.id}-${selectedTab}`}
            className={styles.windowContent}
            trackVisibility='reserve'>
            {selectedTab == 'description' && <DescriptionTab state={details.description} />}

            {selectedTab == 'photoModeSettings' && (
              <PhotoModeSettingsTab state={details.photoModeSettings} />
            )}

            {selectedTab == 'playset' && (
              <PlaysetTab
                screenshotId={screenshot.id}
                state={details.playset}
                shouldLoad={details.shouldLoadPlayset}
              />
            )}
          </Scrollable>
        </Panel>
      </PanelBackdrop>
    </InputActionConsumer>
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
        args={{ ANGLE: <LocalizedNumber value={Math.abs(time.latitude)} unit={Unit.Angle} /> }}
      />
    ),
    sunElevation != undefined && (
      <LocalizedString
        key='sunElevation'
        id='HallOfFame.UI.Menu.ScreenshotDetails.CONDITIONS[Sun Elevation]'
        args={{ ANGLE: <LocalizedNumber value={sunElevation} unit={Unit.Angle} /> }}
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

      {gameChosen.map(setting => (
        <PhotoModeSettingRow key={setting.code} setting={setting} />
      ))}
    </section>
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

      {section.settings.map(setting => (
        <PhotoModeSettingRow key={setting.code} setting={setting} />
      ))}
    </div>
  );
}

/**
 * A setting as the game's photo mode panel names and lays it out, and the mod's note on it.
 */
function PhotoModeSettingRow({ setting }: Readonly<{ setting: PhotoModeSetting }>): ReactElement {
  const translate = useTranslate();

  return (
    <>
      {/* Active, as the panel marks a setting switched on: it dims the name of one that is not. */}
      <div
        className={classNames(
          photoModeContainerClasses.container,
          photoModeContainerClasses.active
        )}>
        <div className={classNames(photoModeContainerClasses.children, styles.photoModeRow)}>
          <PhotoModeTitle code={setting.code} className={styles.photoModeRowName} />
          <div className={styles.photoModeRowValue}>
            <PhotoModeValueView setting={setting} />
          </div>
        </div>
      </div>

      {setting.noteId != undefined && (
        <p className={styles.photoModeNote}>{translate(setting.noteId)}</p>
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
      className={classNames(photoModeContainerClasses.container, photoModeContainerClasses.group)}>
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
 * The creator's playset, asked for when the tab opens: the mod answers at once with one it already
 * holds.
 */
function PlaysetTab({
  screenshotId,
  state,
  shouldLoad
}: Readonly<{
  screenshotId: string;
  state: PlaysetTabState;
  shouldLoad: boolean;
}>): ReactElement {
  const translate = useTranslate();

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
      const { mods } = state;

      return (
        <PlaysetList
          count={mods.length}
          renderRow={index => {
            const mod = mods[index];

            // Keyed on the mod, so a row scrolled from one slot to the next keeps its element, and
            // with it the thumbnail it already loaded.
            return mod && <PlaysetModRow key={mod.id} mod={mod} index={index} />;
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
  const scrollableRef = useRef<HTMLElement | null>(null);

  // The body's `Scrollable` is the window's.
  const findScrollable = useCallback((node: HTMLElement | null) => {
    scrollableRef.current = findScrollableContent(node);
  }, []);

  const rowHeight = useMeasuredRowHeight(
    scrollableRef,
    PLAYSET_ROW_SELECTOR,
    ESTIMATED_ROW_HEIGHT_PX
  );

  const sizeProvider = useUniformSizeProvider(rowHeight, count, PLAYSET_OVERSCAN);

  const { list } = useVirtualList(
    scrollableRef,
    sizeProvider,
    'vertical',
    styles.playset,
    renderRow
  );

  return (
    <>
      {/* The node `findScrollable` climbs out of. */}
      <div ref={findScrollable} />

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
 * What the first frames assume a row measures, before {@link useMeasuredRowHeight} reads a real
 * one: the row's height at the resolution where a `rem` is a pixel.
 */
const ESTIMATED_ROW_HEIGHT_PX = 52;

/**
 * The labels over the playset's columns, lined up with a row's cells.
 */
function PlaysetColumns(): ReactElement {
  const translate = useTranslate();

  return (
    <div className={styles.playsetColumns}>
      <div className={classNames(styles.playsetColumnsLabel, styles.playsetColumnsLabelVersion)}>
        {translate('HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET[Game Version Column]')}
      </div>

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
 * A mod of the playset, opening its Paradox Mods page, its short description in a tooltip.
 * A mod Paradox Mods no longer publishes is dimmed, the server listing those last.
 */
function PlaysetModRow({ mod, index }: Readonly<{ mod: Mod; index: number }>): ReactElement {
  const translate = useTranslate();

  const gameVersion = bindings.useGameVersion();

  const stateLabelId = playsetStateLabelIds.get(mod.state);

  const isOlderVersion =
    mod.requiredGameVersion != null && isOlderGameVersion(mod.requiredGameVersion, gameVersion);

  return (
    <Tooltip
      direction='right'
      tooltip={
        mod.shortDescription ? (
          <TooltipLayout title={mod.name} description={mod.shortDescription} />
        ) : undefined
      }>
      {/* The tooltip's own host element, which the vanilla button would not lend it. */}
      <div
        className={classNames(
          playsetRowClassName(index),
          stateLabelId != undefined && styles.playsetRowUnavailable
        )}
        data-playset-row={true}>
        <Button
          theme={playsetRowButtonTheme}
          // Compared by value, so a row keeps its focus across the list's re-renders.
          focusKey={`mod-${mod.id}`}
          onSelect={() => bindings.openModPage(mod)}>
          <div
            className={styles.playsetRowThumbnail}
            style={{ backgroundImage: `url(${deriveModThumbnailUri(mod.thumbnailUrl)})` }}
          />

          <div className={styles.playsetRowText}>
            <div className={styles.playsetRowName}>{mod.name}</div>
            <div className={styles.playsetRowAuthor}>{mod.authorName}</div>
          </div>

          {/* Every cell rendered, empty or not, so the columns line up from row to row. */}
          {stateLabelId == undefined ? (
            <div
              className={classNames(
                styles.playsetRowCell,
                isOlderVersion && styles.playsetRowCellOlderVersion
              )}
              data-is-older-game-version={isOlderVersion || undefined}>
              {mod.requiredGameVersion}
            </div>
          ) : (
            <div className={styles.playsetRowCell}>{translate(stateLabelId)}</div>
          )}

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
 * A row's classes, every other one banded by its place in the whole list: a CSS `nth-child` would
 * count the rows the virtual list happens to have built, and flip as it scrolls.
 */
function playsetRowClassName(index: number): string {
  return classNames(styles.playsetRow, index % 2 == 1 && styles.playsetRowAlternate);
}

// The label shown in place of the game version of a mod Paradox Mods no longer serves.
const playsetStateLabelIds: ReadonlyMap<Mod['state'], string> = new Map([
  ['removed', 'HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET[Removed]'],
  ['blocked', 'HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET[Blocked]'],
  // Any other Paradox Mods state, under review for one.
  ['unknown', 'HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET[Unavailable]']
]);

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
