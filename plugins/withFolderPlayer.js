const { withAppBuildGradle, withAndroidManifest } = require('expo/config-plugins');
module.exports = function withFolderPlayer(config) {
  config = withAndroidManifest(config, config => {
    const manifest = config.modResults.manifest;
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    // Offline playback needs neither networking nor vibration.
    for (const permission of ['INTERNET', 'ACCESS_NETWORK_STATE', 'VIBRATE']) {
      const name = `android.permission.${permission}`;
      manifest['uses-permission'] = (manifest['uses-permission'] ?? []).filter(item => item.$['android:name'] !== name);
      manifest['uses-permission'].push({ $: { 'android:name': name, 'tools:node': 'remove' } });
    }
    const app = manifest.application[0];
    app.$['android:allowBackup'] = 'false';
    const updatesMetadata = new Set([
      'expo.modules.updates.ENABLED',
      'expo.modules.updates.ENABLE_BSDIFF_PATCH_SUPPORT',
      'expo.modules.updates.EXPO_UPDATES_CHECK_ON_LAUNCH',
      'expo.modules.updates.EXPO_UPDATES_LAUNCH_WAIT_MS',
      ...(app['meta-data'] ?? [])
        .map(item => item.$['android:name'])
        .filter(name => name.startsWith('expo.modules.updates.')),
    ]);
    app['meta-data'] = (app['meta-data'] ?? []).filter(item => !updatesMetadata.has(item.$['android:name']));
    for (const name of updatesMetadata) {
      app['meta-data'].push({ $: { 'android:name': name, 'tools:node': 'remove' } });
    }
    return config;
  });
  return withAppBuildGradle(config, config => {
    const marker = '// Folder Player private release signing';
    // Replace our generated block so repeated prebuilds also pick up plugin changes.
    config.modResults.contents = config.modResults.contents.split(marker)[0].trimEnd();
    config.modResults.contents += `\n\n${marker}
android {
  dependenciesInfo {
    includeInApk = false
    includeInBundle = false
  }
  buildTypes.release {
    signingConfig = null
    minifyEnabled = true
    shrinkResources = true
  }
  splits.abi {
    enable = true
    reset()
    include(*(project.findProperty('reactNativeArchitectures') ?: 'arm64-v8a,armeabi-v7a').split(','))
    universalApk = false
  }
}
def fpCredentialsDir = System.getenv('FOLDER_PLAYER_CREDENTIALS_DIR') ?: rootProject.file('../.credentials').absolutePath
def fpSigningFile = new File(fpCredentialsDir, 'signing.properties')
if (fpSigningFile.exists()) {
  def fpSigning = new Properties()
  fpSigning.load(new FileInputStream(fpSigningFile))
  android.signingConfigs.create('personalRelease') {
    storeFile new File(fpCredentialsDir, 'release.keystore')
    storePassword fpSigning['storePassword']
    keyAlias fpSigning['keyAlias']
    keyPassword fpSigning['keyPassword']
  }
  android.buildTypes.release.signingConfig = android.signingConfigs.personalRelease
}
`;
    return config;
  });
};
