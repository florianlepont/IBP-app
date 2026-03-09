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
    Button: ({ children, ...props }: { children?: React.ReactNode }) => React.createElement('Button', props, children),
    Text: mockComponent('Text'),
    TextInput: mockComponent('TextInput'),
    View: mockComponent('View'),
    StyleSheet: {
      create: <T extends object>(value: T): T => value
    }
  };
});

import { AuthGateScreen } from './AuthGateScreen';

describe('AuthGateScreen', () => {
  it('calls login handler when pressing Login', async () => {
    const onLogin = jest.fn(async () => undefined);

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
          onLogin,
          status: 'Ready'
        })
      );
    });

    const loginButton = component!.root.findByProps({ title: 'Login' });
    await act(async () => {
      loginButton.props.onPress();
    });

    expect(onLogin).toHaveBeenCalledTimes(1);
  });
});
