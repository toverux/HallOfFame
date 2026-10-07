import classNames from 'classnames';
import { LocalizedString } from 'cs2/l10n';
import { Icon } from 'cs2/ui';
import type { ReactElement } from 'react';
import skyveLogoSrc from '../../icons/skyve/skyve-logo.png';
import type { ModHintLabel, ModHintTone, SkyveBlock } from './screenshot-details';
import * as styles from './skyve-verdict.module.scss';

// oxlint-disable-next-line react/only-export-components - no Fast Refresh in a Cohtml bundle
export const skyveVerdictPreloadedIcons: readonly string[] = [skyveLogoSrc];

export function SkyveLogo(): ReactElement {
  return <Icon src={skyveLogoSrc} className={styles.logo} />;
}

/**
 * "Skyve: " and Skyve's label for a mod, in the verdict's tone, crediting Skyve wherever its
 * verdict shows.
 * As a pill, Skyve's logo leads it, on a wash of the tone.
 */
export function SkyveHeading({
  label,
  variant = 'text',
  isInteractive = false,
  className
}: Readonly<{
  label: ModHintLabel;
  variant?: 'text' | 'pill';
  // Whether the pill opens a tooltip, which it lights up on hover for.
  isInteractive?: boolean;
  className?: string;
}>): ReactElement {
  return (
    <div
      className={classNames(
        variant == 'pill'
          ? [styles.pill, pillToneClassNames[label.tone], isInteractive && styles.pillInteractive]
          : textToneClassNames[label.tone],
        className
      )}
      data-tone={label.tone}>
      {variant == 'pill' && <SkyveLogo />}

      <LocalizedString
        id='HallOfFame.UI.Menu.ScreenshotDetails.SKYVE[Verdict]'
        args={{ LABEL: <LocalizedString id={label.labelId} /> }}
      />
    </div>
  );
}

/**
 * Skyve's verdict on a mod as a tooltip tells it: the heading, the reviewer's note, and when and
 * on which game version the review was made.
 * Literal text, not markdown: the note is the reviewer's own, read whole.
 */
export function SkyveVerdictBlock({ block }: Readonly<{ block: SkyveBlock }>): ReactElement {
  return (
    <div className={styles.skyve}>
      <SkyveHeading label={block} className={styles.skyveHeading} />

      {block.note && <p className={styles.skyveNote}>{block.note}</p>}

      {block.review && (
        <p className={styles.skyveReview}>
          <LocalizedString id={block.review.labelId} args={block.review.args} />
        </p>
      )}
    </div>
  );
}

const textToneClassNames: Readonly<Record<ModHintTone, string>> = {
  dimmed: styles.headingDimmed,
  warning: styles.headingWarning,
  negative: styles.headingNegative
};

const pillToneClassNames: Readonly<Record<ModHintTone, string>> = {
  dimmed: styles.pillDimmed,
  warning: styles.pillWarning,
  negative: styles.pillNegative
};
