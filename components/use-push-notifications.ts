import { useAuth } from "@/lib/auth-context";
import { requestAPI } from "@/lib/request";
import * as Sentry from "@sentry/react-native";
import * as Application from "expo-application";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const registerDeviceToken = async (expoPushToken: string, accessToken: string) => {
  const appVersion = Application.nativeApplicationVersion ?? "unknown";
  await requestAPI("/mobile/devices", {
    accessToken,
    method: "POST",
    data: {
      device: {
        token: expoPushToken,
        device_type: Platform.OS,
        app_type: "consumer",
        app_version: appVersion,
      },
    },
  });
};

const getExpoPushToken = async () => {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const tokenData = await Notifications.getDevicePushTokenAsync();
  return tokenData.data;
};

export const usePushNotifications = () => {
  const { accessToken, isAuthenticated } = useAuth();
  const router = useRouter();
  const notificationResponseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;

    getExpoPushToken()
      .then((token) => {
        if (token) registerDeviceToken(token, accessToken);
      })
      .catch((error) => {
        console.error("Failed to register for push notifications:", error);
        Sentry.captureException(error);
      });
  }, [isAuthenticated, accessToken]);

  useEffect(() => {
    notificationResponseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, string> | undefined;
      if (!data?.installment_id) return;

      const params = new URLSearchParams();
      if (data.purchase_id) params.set("purchaseId", data.purchase_id);
      else if (data.subscription_id) params.set("subscriptionId", data.subscription_id);
      else if (data.follower_id) params.set("followerId", data.follower_id);
      const query = params.toString();
      router.push(`/post/${data.installment_id}${query ? `?${query}` : ""}` as any);
    });

    return () => {
      notificationResponseListener.current?.remove();
    };
  }, [router]);
};
