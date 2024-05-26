/**
 * Extensions for menu UI components.
 */

import { getModule, type ModRegistrar } from 'cs2/modding';
import { Button } from 'cs2/ui';
import { type ReactElement, useEffect, useState } from 'react';
import timeControlsStyles from './time-controls.module.scss';

const coTimeControlsStyles: Record<string, string> = getModule(
    'game-ui/game/components/toolbar/bottom/time-controls/time-controls.module.scss',
    'classes'
);

export const register: ModRegistrar = moduleRegistry => {
    moduleRegistry.extend(
        'game-ui/game/components/toolbar/bottom/time-controls/time-controls.tsx',
        'TimeControls',
        COTimeControls => props => (
            <TimeControlsPortal>
                <COTimeControls {...props} />
            </TimeControlsPortal>
        )
    );

    moduleRegistry.extend(
        'game-ui/game/components/toolbar/bottom/time-controls/time-controls.module.scss',
        timeControlsStyles
    );
};

function TimeControlsPortal(props: { children: ReactElement }): ReactElement {
    // REPLACE THESE STATES WITH BINDINGS
    const [isDayDisplayed, setIsDayDisplay] = useState(false);
    const [currentDate, setCurrentDate] = useState(new Date());

    const [dateLabelEl, setDateLabelEl] = useState<{
        timeControls: HTMLElement;
        vanilla: HTMLElement;
        modded: HTMLElement;
    }>();

    useEffect(() => {
        if (!(coTimeControlsStyles.timeControls && coTimeControlsStyles.date)) {
            return console.error(
                'Cannot resolve vanilla classes .time-controls and .date.'
            );
        }

        const [timeControls] = document.getElementsByClassName(
            // biome-ignore lint/style/noNonNullAssertion: <explanation>
            coTimeControlsStyles.timeControls.split(' ')[0]!
        );

        if (!(timeControls instanceof HTMLElement)) {
            return console.error(`Cannot find time controls element.`);
        }

        const [dateEl] = timeControls.getElementsByClassName(
            // biome-ignore lint/style/noNonNullAssertion: <explanation>
            coTimeControlsStyles.date.split(' ')[0]!
        );

        if (!(dateEl instanceof HTMLElement)) {
            return console.error(`Cannot find time controls date element.`);
        }

        const modDateEl = document.createElement('div');
        modDateEl.className = coTimeControlsStyles.date ?? '';

        dateEl.insertAdjacentElement('afterend', modDateEl);

        setDateLabelEl({
            timeControls,
            vanilla: dateEl,
            modded: modDateEl
        });
    }, []);

    useEffect(() => {
        if (!dateLabelEl) {
            return;
        }

        dateLabelEl.vanilla.style.display = isDayDisplayed ? 'none' : 'block';
        dateLabelEl.modded.style.display = isDayDisplayed ? 'block' : 'none';

        if (isDayDisplayed && !dateLabelEl.timeControls.style.width) {
            dateLabelEl.timeControls.style.width = `calc(3.5em + ${dateLabelEl.timeControls.offsetWidth}px)`;
        } else {
            dateLabelEl.timeControls.style.width = '';
        }
    }, [isDayDisplayed, dateLabelEl]);

    useEffect(() => {
        if (!dateLabelEl) {
            return;
        }

        // Note: innerText doesn't work on cohtml
        dateLabelEl.modded.innerHTML = currentDate.toDateString();
    }, [currentDate, dateLabelEl]);

    return (
        <>
            {props.children}

            <Button
                variant='flat'
                onSelect={() => setIsDayDisplay(!isDayDisplayed)}>
                Toggle days
            </Button>

            <Button
                variant='flat'
                onSelect={() =>
                    setCurrentDate(
                        new Date(currentDate.getTime() + 24 * 60 * 60 * 1000)
                    )
                }>
                +1 day
            </Button>
        </>
    );
}
