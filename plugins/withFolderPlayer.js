const { withAppBuildGradle, withAndroidManifest } = require('expo/config-plugins');
module.exports = function withFolderPlayer(config) {
  config = withAndroidManifest(config, config => {
    const app = config.modResults.manifest.application[0];
    app.$['android:allowBackup'] = 'false';
    return config;
  });
  return withAppBuildGradle(config, config => {
    const marker = '// Folder Player private release signing';
    if (!config.modResults.contents.includes(marker)) {
      config.modResults.contents += `\n${marker}\ndef fpSigningFile = rootProject.file('../.credentials/signing.properties')\nif (fpSigningFile.exists()) {\n  def fpSigning = new Properties()\n  fpSigning.load(new FileInputStream(fpSigningFile))\n  android.signingConfigs.create('personalRelease') {\n    storeFile rootProject.file('../.credentials/release.keystore')\n    storePassword fpSigning['storePassword']\n    keyAlias fpSigning['keyAlias']\n    keyPassword fpSigning['keyPassword']\n  }\n  android.buildTypes.release.signingConfig = android.signingConfigs.personalRelease\n}\n`;
    }
    return config;
  });
};
