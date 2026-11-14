import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { Collapsible } from '../Collapsible';

// Icon fonts load asynchronously and are irrelevant to this behaviour.
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

describe('Collapsible', () => {
  it('hides its content until the heading is pressed', () => {
    render(
      <Collapsible title="Chat Messages">
        <Text>Hello there</Text>
      </Collapsible>,
    );

    const heading = screen.getByRole('button', { name: 'Chat Messages' });
    expect(screen.queryByText('Hello there')).toBeNull();
    expect(heading.props.accessibilityState).toEqual({ expanded: false });

    fireEvent.press(heading);
    expect(screen.getByText('Hello there')).toBeTruthy();
    expect(heading.props.accessibilityState).toEqual({ expanded: true });

    fireEvent.press(heading);
    expect(screen.queryByText('Hello there')).toBeNull();
  });

  it('can start expanded', () => {
    render(
      <Collapsible title="Details" initiallyOpen>
        <Text>Visible</Text>
      </Collapsible>,
    );
    expect(screen.getByText('Visible')).toBeTruthy();
  });
});
