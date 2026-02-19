import { LineIcon } from "@/components/icon";
import { StyledImage } from "@/components/styled";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { env } from "@/lib/env";
import { Redirect } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, TextInput, View } from "react-native";
import { useCSSVariable, useUniwind } from "uniwind";
import logoDark from "../assets/images/logo-dark.svg";
import logoLight from "../assets/images/logo.svg";

const forgotPasswordUrl = `${env.EXPO_PUBLIC_GUMROAD_URL}/forgot_password`;

export default function LoginScreen() {
  const { isAuthenticated, isLoading, login } = useAuth();
  const { theme } = useUniwind();
  const mutedColor = useCSSVariable("--color-muted") as string;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  if (isAuthenticated) return <Redirect href="/" />;

  const handleLogin = async () => {
    if (!email.trim() || !password) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDisabled = isLoading || isSubmitting;

  return (
    <KeyboardAvoidingView className="flex-1 bg-background" behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View className="flex-1 items-center justify-center gap-8 px-6">
        <StyledImage source={theme === "dark" ? logoDark : logoLight} className="aspect-158/22 w-50" />

        <View className="w-full max-w-sm gap-4">
          {error && (
            <Alert variant="destructive" icon={<LineIcon name="error" size={20} className="text-destructive" />}>
              <AlertTitle>{error}</AlertTitle>
            </Alert>
          )}

          <View className="rounded border border-border bg-background px-3 py-2">
            <TextInput
              className="font-sans text-base text-foreground"
              placeholder="Email"
              placeholderTextColor={mutedColor}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              editable={!isDisabled}
              testID="email-input"
            />
          </View>

          <View className="rounded border border-border bg-background px-3 py-2">
            <TextInput
              ref={passwordRef}
              className="font-sans text-base text-foreground"
              placeholder="Password"
              placeholderTextColor={mutedColor}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="password"
              autoComplete="password"
              returnKeyType="go"
              onSubmitEditing={handleLogin}
              editable={!isDisabled}
              testID="password-input"
            />
          </View>

          <Button variant="accent" onPress={handleLogin} disabled={isDisabled || !email.trim() || !password}>
            {isSubmitting ? <LoadingSpinner size="small" /> : <Text>Log in</Text>}
          </Button>

          <Button variant="link" onPress={() => WebBrowser.openBrowserAsync(forgotPasswordUrl)} disabled={isDisabled}>
            <Text>Forgot password?</Text>
          </Button>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
