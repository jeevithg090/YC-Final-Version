import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { Avatar, Banner, Button, StateView, TextField, initials } from '..';

// Icon fonts load asynchronously and are irrelevant to these behaviours.
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

describe('Button', () => {
  it('fires onPress and exposes its title as the accessible name', () => {
    const onPress = jest.fn();
    render(<Button title="Log in" onPress={onPress} />);
    fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is disabled and announced as busy while loading', () => {
    const onPress = jest.fn();
    render(<Button title="Save" onPress={onPress} loading />);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button.props.accessibilityState).toMatchObject({ disabled: true, busy: true });
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.queryByText('Save')).toBeNull();
  });
});

describe('TextField', () => {
  it('labels the input and shows validation errors as alerts', () => {
    const onChangeText = jest.fn();
    render(<TextField label="Email" value="" onChangeText={onChangeText} error="Enter your email address." />);
    fireEvent.changeText(screen.getByLabelText('Email'), 'a@b.co');
    expect(onChangeText).toHaveBeenCalledWith('a@b.co');
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Enter your email address.')).toBeTruthy();
  });

  it('shows the hint only when there is no error', () => {
    const { rerender } = render(<TextField label="Password" hint="Use 6 or more characters." />);
    expect(screen.getByText('Use 6 or more characters.')).toBeTruthy();
    rerender(<TextField label="Password" hint="Use 6 or more characters." error="Too short." />);
    expect(screen.queryByText('Use 6 or more characters.')).toBeNull();
  });

  it('hides password text until the toggle is pressed', () => {
    render(<TextField label="Password" password value="secret" />);
    const input = screen.getByLabelText('Password');
    expect(input.props.secureTextEntry).toBe(true);
    fireEvent.press(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(false);
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeTruthy();
  });

  it('never hides the value of a non-password field', () => {
    render(<TextField label="College" value="MIT" />);
    expect(screen.getByLabelText('College').props.secureTextEntry).toBe(false);
  });
});

describe('Banner', () => {
  it('renders error banners as alerts', () => {
    render(<Banner tone="error" title="Couldn’t log in" message="Check your password." />);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Check your password.')).toBeTruthy();
  });
});

describe('StateView', () => {
  it('renders an error state with a retry action', () => {
    const onAction = jest.fn();
    render(<StateView kind="error" message="Network down" actionLabel="Try again" onAction={onAction} />);
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(onAction).toHaveBeenCalled();
  });

  it('labels the loading state for screen readers', () => {
    render(<StateView kind="loading" title="Loading rides…" />);
    expect(screen.getByLabelText('Loading rides…')).toBeTruthy();
  });
});

describe('Avatar', () => {
  it.each([
    ['Asha Rao', 'AR'],
    ['  riya  ', 'R'],
    ['Kabir Mohan Singh', 'KS'],
    ['', '?'],
    [undefined, '?'],
  ])('initials(%p) is %p', (name, expected) => {
    expect(initials(name)).toBe(expected);
  });

  it('falls back to initials without a photo', () => {
    render(<Avatar name="Asha Rao" />);
    expect(screen.getByText('AR')).toBeTruthy();
  });
});
