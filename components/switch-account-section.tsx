import { StyledImage } from "@/components/styled";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Text } from "@/components/ui/text";
import { StoredAccount } from "@/lib/accounts";
import { useAuth } from "@/lib/auth-context";
import { View } from "react-native";

const AccountAvatar = ({ account }: { account: StoredAccount }) =>
  account.avatarUrl ? (
    <StyledImage source={{ uri: account.avatarUrl }} className="size-8 rounded-full" accessibilityIgnoresInvertColors />
  ) : (
    <View className="size-8 items-center justify-center rounded-full bg-accent">
      <Text className="font-bold text-accent-foreground">{account.name.charAt(0).toUpperCase()}</Text>
    </View>
  );

export const SwitchAccountSection = ({ onSwitchStart }: { onSwitchStart?: () => void }) => {
  const { accounts, activeAccountId, isSwitchingAccount, switchAccount } = useAuth();
  const otherAccounts = accounts.filter((account) => account.accountId !== activeAccountId);

  if (accounts.length < 2 || otherAccounts.length === 0) return null;

  return (
    <View testID="switch-account-section" className="border-b border-border p-4">
      <Text className="mb-4 font-sans text-lg text-foreground">Switch account</Text>
      {otherAccounts.map((account) => (
        <Button
          key={account.accountId}
          testID={`switch-account-${account.accountId}`}
          variant="outline"
          className="mb-2 justify-start"
          disabled={isSwitchingAccount}
          accessibilityLabel={`Switch to ${account.name}`}
          onPress={() => {
            onSwitchStart?.();
            void switchAccount(account.accountId);
          }}
        >
          <AccountAvatar account={account} />
          <View className="min-w-0 flex-1">
            <Text numberOfLines={1}>{account.name}</Text>
            {account.username ? (
              <Text numberOfLines={1} className="text-sm text-muted">
                @{account.username}
              </Text>
            ) : null}
          </View>
        </Button>
      ))}
      {isSwitchingAccount ? <LoadingSpinner size="small" /> : null}
    </View>
  );
};
