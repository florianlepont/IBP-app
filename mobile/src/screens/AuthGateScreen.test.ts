import React from 'react';
import renderer, { act } from 'react-test-renderer';

const originalConsoleError = console.error;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    const message = String(args[0] ?? '');
    if (message.includes('react-test-renderer is deprecated')) {
      return;
    }
    if (message.includes('The current testing environment is not configured to support act')) {
      return;
    }
    originalConsoleError(...(args as Parameters<typeof console.error>));
  });
});

afterAll(() => {
  jest.restoreAllMocks();
});

jest.mock('react-native', () => {
  const mockComponent = (name: string) => {
    const ReactRef = require('react') as typeof import('react');
    return ({ children, ...props }: { children?: React.ReactNode }) => ReactRef.createElement(name, props, children);
  };

  return {
    Text: mockComponent('Text'),
    TextInput: mockComponent('TextInput'),
    Pressable: mockComponent('Pressable'),
    Image: mockComponent('Image'),
    ImageBackground: mockComponent('ImageBackground'),
    ScrollView: mockComponent('ScrollView'),
    View: mockComponent('View'),
    useWindowDimensions: () => ({ width: 390, height: 844, scale: 2, fontScale: 1 }),
    StyleSheet: {
      create: <T extends object>(value: T): T => value
    }
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 })
}));

import { AuthGateScreen } from './AuthGateScreen';

describe('AuthGateScreen', () => {
  it('calls login handler when submitting in login mode', async () => {
    const onLogin = jest.fn(async () => undefined);
    const onRegister = jest.fn(async () => undefined);

    let component: renderer.ReactTestRenderer;
    await act(async () => {
      component = renderer.create(
        React.createElement(AuthGateScreen, {
          apiUrl: 'http://localhost:3000/v1',
          onApiUrlChange: jest.fn(),
          email: 'demo@ibp.local',
          onEmailChange: jest.fn(),
          password: 'demo123',
          onPasswordChange: jest.fn(),
          displayName: '',
          onDisplayNameChange: jest.fn(),
          onLogin,
          onRegister,
          status: 'Ready'
        })
      );
    });

    const submitButton = component!.root.findByProps({ testID: 'auth-submit' });
    await act(async () => {
      submitButton.props.onPress();
    });

    expect(onLogin).toHaveBeenCalledTimes(1);
    expect(onRegister).not.toHaveBeenCalled();
  });

  it('calls register handler in register mode when confirmation matches', async () => {
    const onLogin = jest.fn(async () => undefined);
    const onRegister = jest.fn(async () => undefined);

    let component: renderer.ReactTestRenderer;
    await act(async () => {
      component = renderer.create(
        React.createElement(AuthGateScreen, {
          apiUrl: 'http://localhost:3000/v1',
          onApiUrlChange: jest.fn(),
          email: 'new-user@ibp.local',
          onEmailChange: jest.fn(),
          password: 'demo123',
          onPasswordChange: jest.fn(),
          displayName: 'New User',
          onDisplayNameChange: jest.fn(),
          onLogin,
          onRegister,
          status: 'Ready'
        })
      );
    });

    const registerModeButton = component!.root.findByProps({ testID: 'auth-mode-register' });
    await act(async () => {
      registerModeButton.props.onPress();
    });

    const confirmPasswordInput = component!.root.findByProps({ testID: 'auth-confirm-password' });
    await act(async () => {
      confirmPasswordInput.props.onChangeText('demo123');
    });

    const submitButton = component!.root.findByProps({ testID: 'auth-submit' });
    await act(async () => {
      submitButton.props.onPress();
    });

    expect(onRegister).toHaveBeenCalledTimes(1);
    expect(onLogin).not.toHaveBeenCalled();
  });
});
