import { LocalizedString, useLocalization } from 'cs2/l10n';
import { MenuButton } from 'cs2/ui';
import { memo, type ReactElement } from 'react';
import * as bindings from '../../bindings';
import { snappyOnSelect } from '../../utils';
import * as styles from './error.module.scss';
import { locElementToReactNode } from './menu-controls-utils';

export const MenuControlsError = memo(function MenuControlsErrorBase({
  error,
  isReadyForNextImage
}: Readonly<{
  error: LocalizedString;
  isReadyForNextImage: boolean;
}>): ReactElement {
  const { translate } = useLocalization();

  return (
    <div className={styles.error}>
      <div className={styles.errorHeader}>
        <div
          className={styles.errorHeaderImage}
          style={{ backgroundImage: 'url(Media/Game/Icons/AdvisorTrafficAccident.svg)' }}
        />
        <div className={styles.errorHeaderText}>
          <strong>{translate('HallOfFame.Common.OOPS')}</strong>
          {translate('HallOfFame.UI.Menu.MenuControls.COULD_NOT_LOAD_IMAGE')}
        </div>
      </div>

      <LocalizedString
        id={error.id}
        fallback={error.value}
        args={{
          // biome-ignore lint/style/useNamingConvention: i18n convention
          ERROR_MESSAGE: locElementToReactNode(error.args?.ERROR_MESSAGE, 'Unknown error')
        }}
      />

      <strong className={styles.errorGameplayNotAffected}>
        {translate('HallOfFame.UI.Menu.MenuControls.GAMEPLAY_NOT_AFFECTED')}
      </strong>

      <MenuButton
        className={styles.errorButton}
        src='Media/Glyphs/ArrowCircular.svg'
        disabled={!isReadyForNextImage}
        {...snappyOnSelect(bindings.nextScreenshot)}>
        {translate('HallOfFame.UI.Menu.MenuControls.ACTION[Retry]')}
      </MenuButton>
    </div>
  );
});
