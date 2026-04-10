const { withGradleProperties } = require("expo/config-plugins");

module.exports = (config) =>
  withGradleProperties(config, (config) => {
    const jvmArgs = config.modResults.find((item) => item.type === "property" && item.key === "org.gradle.jvmargs");
    if (jvmArgs) {
      jvmArgs.value = "-Xmx4096m -XX:MaxMetaspaceSize=1024m";
    }
    return config;
  });
