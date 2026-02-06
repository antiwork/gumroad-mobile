const { withAndroidManifest, withDangerousMod } = require("expo/config-plugins");
const { writeFileSync, mkdirSync, existsSync } = require("fs");
const { join } = require("path");

const networkSecurityConfig = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="user" />
            <certificates src="system" />
        </trust-anchors>
    </base-config>
</network-security-config>
`;

const withNetworkSecurityConfigFile = (config) => {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const xmlDir = join(
        config.modRequest.platformProjectRoot,
        "app/src/main/res/xml"
      );

      if (!existsSync(xmlDir)) {
        mkdirSync(xmlDir, { recursive: true });
      }

      writeFileSync(
        join(xmlDir, "network_security_config.xml"),
        networkSecurityConfig
      );

      return config;
    },
  ]);
};

const withNetworkSecurityConfigManifest = (config) => {
  return withAndroidManifest(config, async (config) => {
    const manifest = config.modResults.manifest;
    const application = manifest.application?.[0];

    if (application) {
      application.$["android:networkSecurityConfig"] =
        "@xml/network_security_config";
    }

    return config;
  });
};

const withNetworkSecurityConfig = (config) => {
  config = withNetworkSecurityConfigFile(config);
  config = withNetworkSecurityConfigManifest(config);
  return config;
};

module.exports = withNetworkSecurityConfig;
