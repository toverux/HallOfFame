import { afterEach, describe, expect, it } from 'bun:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { bindValue, trigger, useValue } from 'cs2/api';
import { Button } from 'cs2/ui';
import type { ReactElement } from 'react';
import { getTriggers, resetBindings, setBinding } from './game-setup';

afterEach(() => {
  cleanup();
  resetBindings();
});

const GROUP = 'testHarness';

const label$ = bindValue<string>(GROUP, 'label', 'default label');

// A vanilla button showing a value binding, which triggers a command when clicked.
function BoundButton(): ReactElement {
  const label = useValue(label$);

  return <Button onSelect={() => trigger(GROUP, 'clicked', label)}>{label}</Button>;
}

describe('the UI test harness', () => {
  it(`renders a vanilla component with a binding's default value`, () => {
    render(<BoundButton />);

    expect(screen.getByText('default label')).toBeDefined();
  });

  it(`answers a binding with the value a test configured`, () => {
    setBinding(GROUP, 'label', 'configured label');

    render(<BoundButton />);

    expect(screen.getByText('configured label')).toBeDefined();
  });

  it(`records the commands the UI triggers`, () => {
    render(<BoundButton />);

    fireEvent.click(screen.getByText('default label'));

    expect(getTriggers()).toContainEqual({
      event: `${GROUP}.clicked`,
      args: ['default label']
    });
  });
});
