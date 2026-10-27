import { Button } from 'cs2/ui';
import type { ReactElement } from 'react';
import { Tooltip } from '../components/tooltip';
import logoSrc from '../icons/stats-notification.svg';
import { useTranslate } from '../utils';
import * as bindings from '../utils/bindings';

/**
 * Opens the Creator Dashboard from the game's universal mod menu, the panel of mod buttons behind
 * the Paradox Mods glyph of the HUD, which sizes and lays out each button it holds.
 */
export function UniversalModMenuButton(): ReactElement {
  const translate = useTranslate();

  return (
    <Tooltip
      direction='up'
      tooltip={translate('HallOfFame.UI.Game.UniversalModMenuButton.BUTTON_TOOLTIP')}>
      <Button variant='floating' src={logoSrc} tinted={false} onSelect={bindings.openDashboard} />
    </Tooltip>
  );
}
