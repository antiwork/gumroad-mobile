const { execFileSync, spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const SCRIPT = path.join(__dirname, "../scripts/upload-ios-release-symbols.sh");
const RN_VERSION = "0.88.1";
const HERMES_VERSION = "0.14.0";
const MAVEN = "https://repo1.maven.org/maven2";
const RN_MAVEN = `${MAVEN}/com/facebook/react/react-native-artifacts/${RN_VERSION}`;
const ARCHIVE_FRAMEWORKS_DIR = "ios/build/Gumroad.xcarchive/Products/Applications/Gumroad.app/Frameworks";
const ARCHIVE_DSYMS_DIR = "ios/build/Gumroad.xcarchive/dSYMs";
const EXECUTABLE_MODE = 0o755;
const DWARFDUMP_FAILURE_STATUS = 7;

const FRAMEWORKS = [
  {
    label: "hermesvm",
    uuid: "4A1B2C3D-0001-4000-8000-00000000A001",
    url: `${MAVEN}/com/facebook/hermes/hermes-ios/${HERMES_VERSION}/hermes-ios-${HERMES_VERSION}-hermes-framework-dSYM-release.tar.gz`,
    member: "./iphoneos/hermesvm.framework.dSYM/Contents/Resources/DWARF/hermesvm",
  },
  {
    label: "React",
    uuid: "4A1B2C3D-0002-4000-8000-00000000A002",
    url: `${RN_MAVEN}/react-native-artifacts-${RN_VERSION}-reactnative-core-dSYM-release.tar.gz`,
    member: "./ios-arm64/React.framework.dSYM/Contents/Resources/DWARF/React",
  },
  {
    label: "ReactNativeDependencies",
    uuid: "4A1B2C3D-0003-4000-8000-00000000A003",
    url: `${RN_MAVEN}/react-native-artifacts-${RN_VERSION}-reactnative-dependencies-dSYM-release.tar.gz`,
    member: "./ios-arm64/ReactNativeDependencies.framework.dSYM/Contents/Resources/DWARF/ReactNativeDependencies",
  },
];

const STUBS = {
  xcrun: `#!/bin/bash
echo "xcrun $*" >> "$CALL_LOG"
[ "$1 $2" = "dwarfdump --uuid" ] || exit 64
[ -f "$3" ] || exit 1
awk '/^UUID / {print "UUID: " $2 " (arm64) " FILENAME}' "$3"
[ "$3" != "\${DWARFDUMP_FAILS_FOR:-}" ] || exit ${DWARFDUMP_FAILURE_STATUS}
`,
  curl: `#!/bin/bash
while [ $# -gt 0 ]; do
  case "$1" in
    -o) out=$2; shift 2 ;;
    -*) shift ;;
    *) url=$1; shift ;;
  esac
done
echo "curl $url" >> "$CALL_LOG"
case "$url" in ${MAVEN}/*) ;; *) exit 6 ;; esac
cp "$MIRROR/\${url#${MAVEN}/}" "$out" || { echo partial > "$out"; exit 22; }
`,
  node: `#!/bin/sh
exec "${process.execPath}" "$@"
`,
};

const SENTRY_CLI_STUB = `#!/bin/bash
echo "sentry-cli $*" >> "$CALL_LOG"
`;

let root;

const writeFile = (file, contents, mode) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents, { mode });
};

const writeMachO = (file, uuid) => writeFile(file, uuid ? `UUID ${uuid}\n` : "");

const writeDsymTarball = ({ url, member }, uuid) => {
  const stage = fs.mkdtempSync(path.join(root, "stage-"));
  writeMachO(path.join(stage, member), uuid);
  const tarball = path.join(root, "mirror", url.slice(MAVEN.length + 1));
  fs.mkdirSync(path.dirname(tarball), { recursive: true });
  execFileSync("tar", ["-czf", tarball, "-C", stage, "."]);
};

const project = (...segments) => path.join(root, "project", ...segments);

const archivedBinary = (label) => project(ARCHIVE_FRAMEWORKS_DIR, `${label}.framework`, label);

const archivedDsym = (label) => path.join(ARCHIVE_DSYMS_DIR, `${label}.framework.dSYM/Contents/Resources/DWARF`, label);

const runScript = (env = {}) => {
  const callLog = path.join(root, "calls.log");
  fs.writeFileSync(callLog, "");
  const result = spawnSync(project("scripts/upload-ios-release-symbols.sh"), [], {
    cwd: project(),
    encoding: "utf8",
    env: {
      HOME: root,
      PATH: `${path.join(root, "bin")}:/usr/bin:/bin`,
      CALL_LOG: callLog,
      MIRROR: path.join(root, "mirror"),
      SENTRY_AUTH_TOKEN: "test-token",
      ...env,
    },
  });
  return { ...result, calls: fs.readFileSync(callLog, "utf8") };
};

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "upload-ios-release-symbols-"));
  Object.entries(STUBS).forEach(([name, contents]) =>
    writeFile(path.join(root, "bin", name), contents, EXECUTABLE_MODE),
  );
  writeFile(project("scripts/upload-ios-release-symbols.sh"), fs.readFileSync(SCRIPT), EXECUTABLE_MODE);
  writeFile(project("package.json"), JSON.stringify({ dependencies: { "react-native": RN_VERSION } }));
  writeFile(project("ios/sentry.properties"), "defaults.org=example-org\ndefaults.project=example-project\n");
  writeFile(project(`ios/Pods/hermes-engine-artifacts/hermes-ios-${HERMES_VERSION}-release.tar.gz`), "");
  writeFile(project("node_modules/.bin/sentry-cli"), SENTRY_CLI_STUB, EXECUTABLE_MODE);
  FRAMEWORKS.forEach((framework) => {
    writeMachO(archivedBinary(framework.label), framework.uuid);
    writeDsymTarball(framework, framework.uuid);
  });
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("upload-ios-release-symbols.sh", () => {
  it("uploads the dSYM the archive already holds when its uuid matches the framework", () => {
    const [hermes, react, dependencies] = FRAMEWORKS;
    writeMachO(project(archivedDsym("React")), react.uuid);

    const result = runScript();

    expect(result.status).toBe(0);
    expect(result.calls).toContain(`sentry-cli debug-files upload ${archivedDsym("React")}\n`);
    expect(result.calls).not.toContain(react.url);
    expect(result.calls).toContain(`sentry-cli debug-files upload ios/build/symbols/hermesvm/${hermes.member}\n`);
    expect(result.calls).toContain(
      `sentry-cli debug-files upload ios/build/symbols/ReactNativeDependencies/${dependencies.member}\n`,
    );
  });

  it.each(FRAMEWORKS.map(({ label }) => label))("fails when %s.framework is missing from the archive", (label) => {
    fs.rmSync(path.dirname(archivedBinary(label)), { recursive: true });

    const result = runScript();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`${label}: not in the archive`);
  });

  it("fails without uploading when dwarfdump reports no uuid for the framework and its dSYM", () => {
    const [hermes] = FRAMEWORKS;
    writeMachO(archivedBinary(hermes.label), null);
    writeDsymTarball(hermes, null);

    const result = runScript();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("dwarfdump reported no uuid");
    expect(result.calls).not.toContain("sentry-cli");
  });

  it("fails without uploading when dwarfdump prints the framework uuid but exits with an error", () => {
    const result = runScript({ DWARFDUMP_FAILS_FOR: path.relative(project(), archivedBinary("hermesvm")) });

    expect(result.status).toBe(DWARFDUMP_FAILURE_STATUS);
    expect(result.calls).not.toContain("sentry-cli");
  });

  it("fails without uploading when dwarfdump prints the downloaded dSYM uuid but exits with an error", () => {
    const [hermes] = FRAMEWORKS;

    const result = runScript({ DWARFDUMP_FAILS_FOR: `ios/build/symbols/hermesvm/${hermes.member}` });

    expect(result.status).toBe(DWARFDUMP_FAILURE_STATUS);
    expect(result.calls).toContain(`xcrun dwarfdump --uuid ios/build/symbols/hermesvm/${hermes.member}\n`);
    expect(result.calls).not.toContain("sentry-cli");
  });

  it("downloads the dSYM instead when dwarfdump prints the archive dSYM uuid but exits with an error", () => {
    const [, react] = FRAMEWORKS;
    writeMachO(project(archivedDsym("React")), react.uuid);

    const result = runScript({ DWARFDUMP_FAILS_FOR: archivedDsym("React") });

    expect(result.status).toBe(0);
    expect(result.calls).toContain(`xcrun dwarfdump --uuid ${archivedDsym("React")}\n`);
    expect(result.calls).not.toContain(`sentry-cli debug-files upload ${archivedDsym("React")}\n`);
    expect(result.calls).toContain(react.url);
    expect(result.calls).toContain(`sentry-cli debug-files upload ios/build/symbols/React/${react.member}\n`);
  });

  it("fails without uploading when the downloaded dSYM uuid does not match the framework", () => {
    const [, react] = FRAMEWORKS;
    writeDsymTarball(react, "4A1B2C3D-0002-4000-8000-00000000B002");

    const result = runScript();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("React: dSYM uuid 4A1B2C3D-0002-4000-8000-00000000B002 does not match");
    expect(result.calls).not.toContain("sentry-cli debug-files upload ios/build/symbols/React/");
  });

  it("fails without uploading or keeping a partial tarball when a download fails", () => {
    const [, react] = FRAMEWORKS;
    fs.rmSync(path.join(root, "mirror", react.url.slice(MAVEN.length + 1)));

    const result = runScript();

    expect(result.status).not.toBe(0);
    expect(fs.readdirSync(project("ios/build/symbols"))).not.toContainEqual(
      expect.stringContaining(path.basename(react.url)),
    );
    expect(result.calls).not.toContain("sentry-cli debug-files upload ios/build/symbols/React/");
  });

  it("fails when react-native is not pinned to an exact version", () => {
    writeFile(project("package.json"), JSON.stringify({ dependencies: { "react-native": `^${RN_VERSION}` } }));

    const result = runScript();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("this script needs an exact version");
  });

  it("fails when an upload fails even if SENTRY_ALLOW_FAILURE is set", () => {
    writeFile(
      project("node_modules/.bin/sentry-cli"),
      `${SENTRY_CLI_STUB}[ "\${SENTRY_ALLOW_FAILURE:-}" = true ]\n`,
      EXECUTABLE_MODE,
    );

    const result = runScript({ SENTRY_ALLOW_FAILURE: "true" });

    expect(result.status).not.toBe(0);
  });
});
