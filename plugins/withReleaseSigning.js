// Android release builds signed with myQode's Play Store upload key, read from the machine's own
// ~/.gradle/gradle.properties (never from the repository):
//   MYQODE_UPLOAD_STORE_FILE=/Users/<you>/keys/myqode-upload.jks
//   MYQODE_UPLOAD_STORE_PASSWORD=…   MYQODE_UPLOAD_KEY_ALIAS=…   MYQODE_UPLOAD_KEY_PASSWORD=…
// The key is the one Play Console lists as the upload key (SHA-1 43:AF:35:02:…:20:54, the original myQode
// Expo project's keystore). Without those properties the release build falls back to the debug key, so local APKs
// still build — scripts/android-release.sh refuses to produce a store bundle in that case.
const { withAppBuildGradle } = require('expo/config-plugins');

const RELEASE_CONFIG = `
        release {
            // myQode upload key from ~/.gradle/gradle.properties (plugins/withReleaseSigning.js)
            if (project.hasProperty('MYQODE_UPLOAD_STORE_FILE')) {
                storeFile file(MYQODE_UPLOAD_STORE_FILE)
                storePassword MYQODE_UPLOAD_STORE_PASSWORD
                keyAlias MYQODE_UPLOAD_KEY_ALIAS
                keyPassword MYQODE_UPLOAD_KEY_PASSWORD
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, cfg => {
    let g = cfg.modResults.contents;
    if (!g.includes('MYQODE_UPLOAD_STORE_FILE')) {
      // a release signing config next to the debug one
      g = g.replace(/(signingConfigs\s*\{\s*\n\s*debug\s*\{[^}]*\})/, `$1${RELEASE_CONFIG}`);
      // the release build type uses it when the properties exist
      g = g.replace(/(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/,
        "$1signingConfig project.hasProperty('MYQODE_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug");
    }
    cfg.modResults.contents = g;
    return cfg;
  });
};
