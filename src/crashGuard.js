// Last line of defence: if any screen throws while rendering, show a calm message with "Try again" instead of a
// blank screen or the red error page. "Try again" mounts the app afresh (the saved session is kept, so the user lands
// back in the app, not on the sign-in screen).
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { MSG } from './errors';
import { reportError } from './monitoring';

export default class CrashGuard extends React.Component {
  state = { failed: false, attempt: 0 };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error, info) {
    // Developers still see the cause in the logs and in Sentry (src/monitoring.js); users never see it.
    console.warn('[myQode] screen crashed:', error && error.message, info && info.componentStack ? info.componentStack.split('\n').slice(0, 4).join(' ') : '');
    reportError(error, { componentStack: info && info.componentStack ? info.componentStack.split('\n').slice(0, 12).join('\n') : '' });
  }
  retry = () => this.setState(s => ({ failed: false, attempt: s.attempt + 1 }));
  render() {
    if (!this.state.failed) return <React.Fragment key={this.state.attempt}>{this.props.children}</React.Fragment>;
    return (
      <View style={{ flex: 1, backgroundColor: '#EFECD3', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text style={{ fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 22, color: '#002017', textAlign: 'center' }}>Something went wrong</Text>
        <Text style={{ fontFamily: 'Lato_400Regular', fontSize: 14, lineHeight: 21, color: '#37584F', textAlign: 'center', marginTop: 10, maxWidth: 320 }}>
          {MSG.generic.replace('Something went wrong. ', '')} If it keeps happening, please contact Investor Relations.
        </Text>
        <Pressable onPress={this.retry} accessibilityRole="button" style={({ pressed }) => ({ marginTop: 22, backgroundColor: '#02422B', borderRadius: 999, paddingVertical: 12, paddingHorizontal: 32, opacity: pressed ? 0.8 : 1 })}>
          <Text style={{ fontFamily: 'Lato_700Bold', fontSize: 13, letterSpacing: 1.2, color: '#DABD38' }}>TRY AGAIN</Text>
        </Pressable>
      </View>
    );
  }
}
