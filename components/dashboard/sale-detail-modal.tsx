import { RefundForm } from "@/components/dashboard/refund-form";
import { useSaleDetail } from "@/components/dashboard/use-sales-analytics";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { ScrollView, View } from "react-native";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

export const SaleDetailModal = ({ saleId, onClose }: { saleId: string | null; onClose: () => void }) => {
  const { data: sale, isLoading } = useSaleDetail(saleId);

  return (
    <Sheet open={!!saleId} onOpenChange={(open) => !open && onClose()}>
      <SheetHeader onClose={onClose}>
        <SheetTitle>{sale?.name}</SheetTitle>
      </SheetHeader>
      <SheetContent>
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <LoadingSpinner size="large" />
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

            <RefundForm sale={sale} />
          </ScrollView>
        ) : (
          <View className="flex-1 items-center justify-center">
            <Text className="font-sans text-lg text-muted">Sale not found</Text>
          </View>
        )}
      </SheetContent>
    </Sheet>
  );
};
