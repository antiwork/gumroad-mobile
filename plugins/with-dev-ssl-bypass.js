const {
  withDangerousMod,
  withAndroidManifest,
  withXcodeProject,
} = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const networkSecurityConfig = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system"/>
            <certificates src="user"/>
        </trust-anchors>
    </base-config>
</network-security-config>
`;

const sslBypassObjCImpl = `#import <Foundation/Foundation.h>
#import <objc/runtime.h>
#import <Security/Security.h>
#import <React/RCTHTTPRequestHandler.h>

#if DEBUG

static void trustAllChallenges(NSURLAuthenticationChallenge *challenge,
                               void (^completionHandler)(NSURLSessionAuthChallengeDisposition, NSURLCredential *)) {
    NSLog(@"[SSLBypass] Challenge auth method: %@", challenge.protectionSpace.authenticationMethod);

    if ([challenge.protectionSpace.authenticationMethod isEqualToString:NSURLAuthenticationMethodServerTrust]) {
        SecTrustRef serverTrust = challenge.protectionSpace.serverTrust;
        if (serverTrust) {
            NSLog(@"[SSLBypass] Got serverTrust, creating credential for host: %@", challenge.protectionSpace.host);
            NSURLCredential *credential = [NSURLCredential credentialForTrust:serverTrust];
            NSLog(@"[SSLBypass] Created credential, calling completionHandler with UseCredential");
            completionHandler(NSURLSessionAuthChallengeUseCredential, credential);
            return;
        } else {
            NSLog(@"[SSLBypass] serverTrust is nil!");
        }
    }

    NSLog(@"[SSLBypass] Falling back to default handling");
    completionHandler(NSURLSessionAuthChallengePerformDefaultHandling, nil);
}

@implementation RCTHTTPRequestHandler (SSLBypass)

+ (void)load {
    NSLog(@"[SSLBypass] RCTHTTPRequestHandler+SSLBypass loaded");

    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        Class class = [self class];

        // Add session-level challenge handler
        SEL sessionSelector = @selector(URLSession:didReceiveChallenge:completionHandler:);
        Method sessionMethod = class_getInstanceMethod(class, sessionSelector);

        if (sessionMethod) {
            NSLog(@"[SSLBypass] Original session challenge method exists, swizzling");
            SEL swizzledSessionSelector = @selector(bypass_URLSession:didReceiveChallenge:completionHandler:);
            Method swizzledSessionMethod = class_getInstanceMethod(class, swizzledSessionSelector);
            if (swizzledSessionMethod) {
                method_exchangeImplementations(sessionMethod, swizzledSessionMethod);
            }
        } else {
            NSLog(@"[SSLBypass] Original session challenge method does NOT exist, adding");
            IMP imp = imp_implementationWithBlock(^(id self, NSURLSession *session,
                                                    NSURLAuthenticationChallenge *challenge,
                                                    void (^completionHandler)(NSURLSessionAuthChallengeDisposition, NSURLCredential *)) {
                NSLog(@"[SSLBypass] Session challenge handler called for: %@", challenge.protectionSpace.host);
                trustAllChallenges(challenge, completionHandler);
            });
            const char *types = "v@:@@@";
            class_addMethod(class, sessionSelector, imp, types);
        }

        // Add task-level challenge handler
        SEL taskSelector = @selector(URLSession:task:didReceiveChallenge:completionHandler:);
        Method taskMethod = class_getInstanceMethod(class, taskSelector);

        if (taskMethod) {
            NSLog(@"[SSLBypass] Original task challenge method exists, swizzling");
            SEL swizzledTaskSelector = @selector(bypass_URLSession:task:didReceiveChallenge:completionHandler:);
            Method swizzledTaskMethod = class_getInstanceMethod(class, swizzledTaskSelector);
            if (swizzledTaskMethod) {
                method_exchangeImplementations(taskMethod, swizzledTaskMethod);
            }
        } else {
            NSLog(@"[SSLBypass] Original task challenge method does NOT exist, adding");
            IMP imp = imp_implementationWithBlock(^(id self, NSURLSession *session, NSURLSessionTask *task,
                                                    NSURLAuthenticationChallenge *challenge,
                                                    void (^completionHandler)(NSURLSessionAuthChallengeDisposition, NSURLCredential *)) {
                NSLog(@"[SSLBypass] Task challenge handler called for: %@", challenge.protectionSpace.host);
                trustAllChallenges(challenge, completionHandler);
            });
            const char *types = "v@:@@@@";
            class_addMethod(class, taskSelector, imp, types);
        }

        // Hook into didCompleteWithError to see what error we get
        SEL completeSelector = @selector(URLSession:task:didCompleteWithError:);
        Method completeMethod = class_getInstanceMethod(class, completeSelector);

        if (completeMethod) {
            NSLog(@"[SSLBypass] Swizzling didCompleteWithError");
            SEL swizzledCompleteSelector = @selector(bypass_URLSession:task:didCompleteWithError:);
            Method swizzledCompleteMethod = class_getInstanceMethod(class, swizzledCompleteSelector);
            if (swizzledCompleteMethod) {
                method_exchangeImplementations(completeMethod, swizzledCompleteMethod);
            }
        }
    });
}

- (void)bypass_URLSession:(NSURLSession *)session
                     task:(NSURLSessionTask *)task
      didCompleteWithError:(NSError *)error {
    if (error) {
        NSLog(@"[SSLBypass] Task completed with ERROR: %@", error);
        NSLog(@"[SSLBypass] Error domain: %@, code: %ld", error.domain, (long)error.code);
        NSLog(@"[SSLBypass] Error userInfo: %@", error.userInfo);
    } else {
        NSLog(@"[SSLBypass] Task completed successfully");
    }
    // Call original
    [self bypass_URLSession:session task:task didCompleteWithError:error];
}

- (void)bypass_URLSession:(NSURLSession *)session
                     task:(NSURLSessionTask *)task
      didReceiveChallenge:(NSURLAuthenticationChallenge *)challenge
        completionHandler:(void (^)(NSURLSessionAuthChallengeDisposition, NSURLCredential *))completionHandler {
    NSLog(@"[SSLBypass] bypass task challenge called for: %@", challenge.protectionSpace.host);
    trustAllChallenges(challenge, completionHandler);
}

- (void)bypass_URLSession:(NSURLSession *)session
      didReceiveChallenge:(NSURLAuthenticationChallenge *)challenge
        completionHandler:(void (^)(NSURLSessionAuthChallengeDisposition, NSURLCredential *))completionHandler {
    NSLog(@"[SSLBypass] bypass session challenge called for: %@", challenge.protectionSpace.host);
    trustAllChallenges(challenge, completionHandler);
}

@end
#endif
`;

const withAndroidNetworkSecurityConfig = (config) => {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const xmlDir = path.join(
        config.modRequest.platformProjectRoot,
        "app/src/main/res/xml"
      );
      if (!fs.existsSync(xmlDir)) {
        fs.mkdirSync(xmlDir, { recursive: true });
      }
      fs.writeFileSync(
        path.join(xmlDir, "network_security_config.xml"),
        networkSecurityConfig
      );
      return config;
    },
  ]);
};

const withAndroidManifestNetworkConfig = (config) => {
  return withAndroidManifest(config, async (config) => {
    const mainApplication = config.modResults.manifest.application[0];
    mainApplication.$["android:networkSecurityConfig"] =
      "@xml/network_security_config";
    return config;
  });
};

const withIOSSSLBypassFile = (config) => {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const projectName = config.modRequest.projectName;
      const projectRoot = config.modRequest.platformProjectRoot;
      const projectDir = path.join(projectRoot, projectName);

      fs.writeFileSync(
        path.join(projectDir, "DevSSLBypass.m"),
        sslBypassObjCImpl
      );

      return config;
    },
  ]);
};

const withIOSSSLBypassXcodeProject = (config) => {
  return withXcodeProject(config, async (config) => {
    const projectName = config.modRequest.projectName;
    const project = config.modResults;

    const targetUuid = project.findTargetKey(projectName);
    const groupUuid = project.findPBXGroupKey({ name: projectName });

    if (groupUuid) {
      project.addSourceFile(
        `${projectName}/DevSSLBypass.m`,
        { target: targetUuid },
        groupUuid
      );
    }

    return config;
  });
};

const withDevSSLBypass = (config) => {
  config = withAndroidNetworkSecurityConfig(config);
  config = withAndroidManifestNetworkConfig(config);
  config = withIOSSSLBypassFile(config);
  config = withIOSSSLBypassXcodeProject(config);
  return config;
};

module.exports = withDevSSLBypass;
