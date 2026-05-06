import { EmailDetailSheet } from "@/components/emails/email-detail-sheet";
import { EmailRowCard } from "@/components/emails/email-row";
import type { EmailRow } from "@/components/emails/types";
import { useEmailsList } from "@/components/emails/use-emails-list";
import { Banner } from "@/components/ui/banner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { useCSSVariable } from "uniwind";

export default function EmailsScreen() {
  const { data, isLoading, isError, isRefetching, refetch } = useEmailsList();
  const accentColor = useCSSVariable("--color-accent") as string;
  const [selectedRow, setSelectedRow] = useState<EmailRow | null>(null);

  return (
    <Screen>
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <LoadingSpinner size="large" />
        </View>
      ) : isError ? (
        <Banner
          variant="error"
          message="Couldn't load emails. Pull down to retry."
          actionLabel="Retry"
          onAction={() => refetch()}
        />
      ) : (
        <FlatList<EmailRow>
          data={data?.installments ?? []}
          keyExtractor={(item) => item.external_id}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={accentColor} />
          }
          renderItem={({ item }) => <EmailRowCard row={item} onPress={setSelectedRow} />}
          ListEmptyComponent={
            <View className="items-center justify-center py-20 px-4">
              <Text className="text-base font-medium text-foreground">No emails yet</Text>
              <Text className="mt-1 text-sm text-muted-foreground text-center">
                Tap + to compose your first one.
              </Text>
            </View>
          }
        />
      )}
      <EmailDetailSheet row={selectedRow} onClose={() => setSelectedRow(null)} />
    </Screen>
  );
}
