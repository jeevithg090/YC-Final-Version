import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { ConfigurationRequired } from '../ConfigurationRequired';

describe('ConfigurationRequired', () => {
  it('lists each missing environment variable', () => {
    render(<ConfigurationRequired missing={['EXPO_PUBLIC_FIREBASE_API_KEY', 'EXPO_PUBLIC_FIREBASE_APP_ID']} />);

    expect(screen.getByText('Configuration required')).toBeTruthy();
    expect(screen.getByText(/EXPO_PUBLIC_FIREBASE_API_KEY/)).toBeTruthy();
    expect(screen.getByText(/EXPO_PUBLIC_FIREBASE_APP_ID/)).toBeTruthy();
  });
});
