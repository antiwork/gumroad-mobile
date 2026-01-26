import { useSaleDetail } from "@/components/dashboard/use-sales-analytics";
import { LineIcon } from "@/components/icon";
import { Text } from "@/components/ui/text";
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from "react-native";
import { useCSSVariable } from "uniwind";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

export const SaleDetailModal = ({ saleId, onClose }: { saleId: string | null; onClose: () => void }) => {
  const { data: sale, isLoading } = useSaleDetail(saleId);
  const accentColor = useCSSVariable("--color-accent") as string;

  return (
    <Modal visible={!!saleId} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-background">
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <Text className="font-sans text-lg font-semibold text-foreground">{sale?.name}</Text>
          <Pressable onPress={onClose} className="p-2">
            <LineIcon name="x" size={24} className="text-foreground" />
          </Pressable>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={accentColor} />
          </View>
        ) : sale ? (
          <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, gap: 16 }}>
            <Card>
              <CardHeader>
                <CardTitle>Email</CardTitle>
              </CardHeader>
              <CardContent>
                <Text className="font-bold">{sale.purchase_email}</Text>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Full name</CardTitle>
              </CardHeader>
              <CardContent>
                <Text className="font-bold">{sale.full_name}</Text>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Order information</CardTitle>
              </CardHeader>
              <CardContent className="flex-row justify-between border-b border-border">
                <Text className="font-bold">Order number</Text>
                <Text>{sale.order_id}</Text>
              </CardContent>
              <CardContent className="flex-row justify-between">
                <Text className="font-bold">Quantity</Text>
                <Text>{sale.quantity}</Text>
              </CardContent>
            </Card>
          </ScrollView>
        ) : (
          <View className="flex-1 items-center justify-center">
            <Text className="font-sans text-lg text-muted">Sale not found</Text>
          </View>
        )}
      </View>
    </Modal>
  );
};
