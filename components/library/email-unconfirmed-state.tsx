import { useResendConfirmationEmail } from "@/components/library/use-resend-confirmation-email";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { View } from "react-native";

const INTRO_MESSAGE = "We emailed you a confirmation link. Open it, then come back here.";
const SENT_MESSAGE = "We sent you a new email. Check your inbox and spam folder.";

const statusMessage = (state: ReturnType<typeof useResendConfirmationEmail>["state"]) => {
  if (state === "throttled") return "We just sent you an email. Please wait a minute before asking for another.";
  if (state === "failed") return "We couldn't send the email. Check your connection and try again.";
  return null;
};

export const EmailUnconfirmedState = ({
  isRefreshing,
  onRefresh,
}: {
  isRefreshing: boolean;
  onRefresh: () => void;
}) => {
  const { resend, state, secondsLeft, hasSent, isSending } = useResendConfirmationEmail(onRefresh);
  const message = statusMessage(state);
  const intro = hasSent ? SENT_MESSAGE : INTRO_MESSAGE;
  const resendDisabled = isSending || secondsLeft > 0;

  return (
    <Screen>
      <View className="flex-1 items-center justify-center gap-4 p-8">
        <Text className="text-center font-sans text-lg font-bold text-foreground">
          Confirm your email to see your library
        </Text>
        <Text className="text-center font-sans text-foreground" accessibilityLiveRegion="polite">
          {intro}
        </Text>
        {message ? (
          <Text className="text-center font-sans text-sm text-muted-foreground" accessibilityLiveRegion="polite">
            {message}
          </Text>
        ) : null}
        <View className="w-full gap-3">
          <Button disabled={isRefreshing} onPress={onRefresh}>
            <Text>I&apos;ve confirmed my email</Text>
          </Button>
          <Button variant="outline" disabled={resendDisabled} onPress={resend}>
            <Text>{secondsLeft > 0 ? `Send again in ${secondsLeft}s` : "Send the email again"}</Text>
          </Button>
        </View>
      </View>
    </Screen>
  );
};
