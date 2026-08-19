import classNames from 'classnames';
import { Dropdown, DropdownItem } from 'cs2/ui';
import {
  type PropsWithChildren,
  type ReactElement,
  useContext,
  useEffect,
  useRef,
  useState
} from 'react';
import externalLinkSrc from '../../icons/fontawesome/arrow-up-right-from-square-solid.svg';
import linkSolidSrc from '../../icons/fontawesome/link-solid.svg';
import { useTranslate } from '../../utils';
import * as bindings from '../../utils/bindings';
import { DOMNodeContext } from '../../vanilla-modules/game-ui/common/dom-node/dom-node';
import { DropdownContext } from '../../vanilla-modules/game-ui/common/input/dropdown/dropdown';
import { dropdownMenuTheme, iconTintFromStylesheet } from './dropdown-menu';
import * as styles from './viewer-link.module.scss';

/**
 * Both of the menu's icons, for the preloading the controls do on its behalf.
 *
 * Neither is on screen until the menu opens, so each is otherwise fetched on the frame it is meant
 * to be drawn. The preloading belongs to the controls and not to this component because this one
 * remounts on every screenshot, which would unpin the images and fetch them again each slide.
 */
// oxlint-disable-next-line react/only-export-components - no Fast Refresh in a Cohtml bundle
export const viewerLinkPreloadedIcons: readonly string[] = [externalLinkSrc, linkSolidSrc];

/**
 * Turns a name into a link to its page on the web viewer: clicking it opens a menu offering to copy
 * the link or to open it in the default browser.
 *
 * The menu is the game's own {@link Dropdown}, so click-outside dismissal, the `Back` input action,
 * the pointer barrier, select sounds, and edge flipping all come from the game rather than from
 * here.
 * The price is that it opens under the name instead of at the cursor, which on a target the size of
 * a name is not worth a hand-rolled popup.
 *
 * `trackedUrl` is the server redirect that counts the click, and it is what a real human click
 * should use, while `shareUrl` is the plain viewer page, which is what belongs on the clipboard.
 */
export function MenuControlsViewerLink({
  trackedUrl,
  shareUrl,
  onToggle,
  children
}: Readonly<
  PropsWithChildren<{
    trackedUrl: string;
    shareUrl: string;
    onToggle: (isOpen: boolean) => void;
  }>
>): ReactElement {
  const translate = useTranslate();

  const [isCopied, setIsCopied] = useState(false);

  // The menu deliberately stays open after a copy, so the player can also open the link without
  // reopening it, which leaves closing the menu as the only moment the confirmation can retire.
  function handleVisibleChange(isOpen: boolean): void {
    if (!isOpen) {
      setIsCopied(false);
    }

    onToggle(isOpen);
  }

  function handleCopy(): void {
    bindings.copyViewerLink(shareUrl);

    setIsCopied(true);
  }

  return (
    // The toggle claims the nearest `DOMNodeContext` below, and that has to be the dropdown's own.
    // The context reaches every descendant, so without this the toggle would also claim the handle
    // of an enclosing tooltip; opening the menu then re-resolves that handle, which strips the
    // tooltip's listeners off the element and never restores them, killing it for good.
    <DOMNodeContext.Provider value={undefined}>
      <Dropdown
        theme={dropdownMenuTheme}
        content={
          <>
            <DropdownItem<string>
              value='open'
              icon={externalLinkSrc}
              iconTint={iconTintFromStylesheet}
              onChange={() => bindings.openViewerLink(trackedUrl)}>
              {translate('HallOfFame.UI.Menu.MenuControls.LINK_ACTION[Open]')}
            </DropdownItem>

            <DropdownItem<string>
              value='copy'
              icon={linkSolidSrc}
              iconTint={iconTintFromStylesheet}
              closeOnSelect={false}
              onChange={handleCopy}>
              {translate(
                isCopied
                  ? 'HallOfFame.UI.Menu.MenuControls.LINK_ACTION[Copied]'
                  : 'HallOfFame.UI.Menu.MenuControls.LINK_ACTION[Copy]'
              )}
            </DropdownItem>
          </>
        }>
        <ViewerLinkToggle onVisibleChange={handleVisibleChange}>{children}</ViewerLinkToggle>
      </Dropdown>
    </DOMNodeContext.Provider>
  );
}

/**
 * The name itself, as the dropdown's toggle.
 *
 * A plain span rather than the vanilla `DropdownToggle`, which renders a `<button>`: in Cohtml a
 * button inherits neither color, font nor text-shadow, so the name would stop looking like the text
 * around it and no CSS could put it back. Going through the context instead keeps the markup inert
 * and keeps the names out of the controller focus order, which is where they belong since the hover
 * underline is a mouse affordance anyway.
 * The sound is not lost with the button: the vanilla `toggle` plays it.
 *
 * Standing in for a vanilla leaf also means taking on a vanilla leaf's duty: the span carries the
 * {@link DOMNodeContext} handle, which is what the popup measures to place itself against.
 * That handle is the dropdown's alone, the provider above having cut the chain, so an enclosing
 * tooltip gets none of it and needs a host element of its own to anchor to. Every call site owes
 * the link that wrapper.
 *
 * Being inside the dropdown is also the only place its `visible` can be read, and reading it is the
 * only reliable way to know the menu closed: the vanilla click-outside path sets the state directly
 * and never reaches the `onToggle` the dropdown otherwise reports through.
 */
function ViewerLinkToggle({
  onVisibleChange,
  children
}: Readonly<PropsWithChildren<{ onVisibleChange: (isOpen: boolean) => void }>>): ReactElement {
  const { visible, toggle } = useContext(DropdownContext);

  const domNode = useContext(DOMNodeContext);

  // Held in a ref, so the effects below track the menu's visibility alone and do not re-fire just
  // because the parent handed down a fresh callback.
  const onVisibleChangeRef = useRef(onVisibleChange);

  onVisibleChangeRef.current = onVisibleChange;

  useEffect(() => {
    onVisibleChangeRef.current(visible);
  }, [visible]);

  // A screenshot change remounts this link, taking an open menu with it and leaving no one to say
  // that it went.
  useEffect(() => () => onVisibleChangeRef.current(false), []);

  return (
    <span
      ref={domNode?.ref}
      className={classNames(styles.link, domNode?.className)}
      style={domNode?.style}
      // The menu covers the screen with a pointer barrier while it is open, so `:hover` stops
      // firing; this is what keeps the underline lit until the menu closes.
      data-open={visible ? '' : undefined}
      onClick={toggle}>
      {children}
    </span>
  );
}
