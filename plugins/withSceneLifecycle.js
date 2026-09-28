// iOS 27 SDK: UIKit traps at launch (EXC_BREAKPOINT in
// _UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption) unless the app adopts the UIScene life cycle.
// The SDK 57 prebuild template still starts React Native from the app delegate, so this plugin switches it to
// Expo's ExpoAppSceneDelegate (node_modules/expo/ios/AppDelegates/ExpoAppSceneDelegate.swift):
//  - Info.plist: a scene manifest whose delegate is EXExpoAppSceneDelegate
//  - AppDelegate: conforms to ExpoReactNativeFactoryProvider and only creates the factory; the scene
//    delegate creates the window and starts React Native into it.
const { withInfoPlist, withAppDelegate } = require('expo/config-plugins');

const withSceneManifest = config => withInfoPlist(config, cfg => {
  cfg.modResults.UIApplicationSceneManifest = {
    UIApplicationSupportsMultipleScenes: false,
    UISceneConfigurations: {
      UIWindowSceneSessionRoleApplication: [
        { UISceneConfigurationName: 'Default Configuration', UISceneDelegateClassName: 'EXExpoAppSceneDelegate' },
      ],
    },
  };
  return cfg;
});

const START_RN = /\n#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\(\n\s*withModuleName: "main",\n\s*in: window,\n\s*launchOptions: launchOptions\)\n#endif\n/;

const withSceneAppDelegate = config => withAppDelegate(config, cfg => {
  if (cfg.modResults.language !== 'swift') throw new Error('withSceneLifecycle: expected a Swift AppDelegate');
  let src = cfg.modResults.contents;
  if (!src.includes('ExpoReactNativeFactoryProvider')) {
    src = src.replace('class AppDelegate: ExpoAppDelegate {', 'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {');
  }
  if (START_RN.test(src)) {
    src = src.replace(START_RN, '\n    // The window and React Native are started by the scene delegate (EXExpoAppSceneDelegate, Info.plist).\n');
  }
  if (!src.includes('ExpoReactNativeFactoryProvider') || src.includes('UIWindow(frame: UIScreen.main.bounds)')) {
    throw new Error('withSceneLifecycle: AppDelegate template changed — update plugins/withSceneLifecycle.js');
  }
  cfg.modResults.contents = src;
  return cfg;
});

module.exports = config => withSceneAppDelegate(withSceneManifest(config));
