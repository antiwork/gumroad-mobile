import { refundSale, SaleDetail } from "@/components/dashboard/use-sales-analytics";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { useState } from "react";
import { Keyboard, Alert as NativeAlert, TextInput, View } from "react-native";
import { useCSSVariable } from "uniwind";
import { SolidIcon } from "../icon";
import { Alert, AlertTitle } from "../ui/alert";

const REFUND_FEE_HELP_URL = "https://help.gumroad.com/article/15-refunds";

export const RefundForm = ({ sale, onRefundSuccess }: { sale: SaleDetail; onRefundSuccess?: () => void }) => {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const mutedColor = useCSSVariable("--color-muted") as string;

  const [refundAmountInput, setRefundAmountInput] = useState("");
  const [isRefunding, setIsRefunding] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);
  const [refundSuccess, setRefundSuccess] = useState(false);
  const [isPartialRefund, setIsPartialRefund] = useState(false);

  const amountRefundable = parseFloat(sale.amount_refundable_in_currency) || 0;
  const inputAmount = parseFloat(refundAmountInput) || 0;
  const isPartialAmount = refundAmountInput !== "" && inputAmount < amountRefundable;

  if (sale.in_app_purchase_platform) {
    const platformName = sale.in_app_purchase_platform === "apple" ? "Apple" : "Google";
    return (
      <Card>
        <CardHeader>
          <CardTitle>Refund</CardTitle>
        </CardHeader>
        <CardContent>
          <Text>In-app purchases cannot be refunded directly. The buyer can request a refund from {platformName}.</Text>
        </CardContent>
      </Card>
    );
  }

  if (sale.refunded || sale.partially_refunded || refundSuccess) {
    return (
      <Alert variant="info" icon={<SolidIcon name="info-circle" size={24} className="text-info" />}>
        <AlertTitle>{isPartialRefund || sale.partially_refunded ? "Partially refunded" : "Refunded"}</AlertTitle>
      </Alert>
    );
  }

  if (amountRefundable <= 0) {
    return null;
  }

  const handleRefund = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const refundAmount = refundAmountInput.trim() || sale.amount_refundable_in_currency;
    const displayAmount = `${sale.currency_symbol}${refundAmount}`;

    NativeAlert.alert("Purchase refund", `Would you like to confirm this purchase refund of ${displayAmount}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm refund",
        style: "destructive",
        onPress: confirmRefund,
      },
    ]);
  };

  const confirmRefund = async () => {
    if (!accessToken) return;

    Keyboard.dismiss();
    setIsRefunding(true);
    setRefundError(null);

    try {
      const response = await refundSale({
        purchaseId: sale.purchase_id,
        amount: refundAmountInput.trim() || undefined,
        accessToken,
      });

      if (response.success) {
        setRefundSuccess(true);
        setIsPartialRefund(isPartialAmount);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        queryClient.invalidateQueries({ queryKey: ["sale", sale.id] });
        queryClient.invalidateQueries({ queryKey: ["analytics"] });

        onRefundSuccess?.();
      } else {
        setRefundError(response.message || "Refund failed");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (error) {
      setRefundError(error instanceof Error ? error.message : "Refund failed");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsRefunding(false);
    }
  };

  const buttonText = isPartialAmount ? "Issue partial refund" : "Refund fully";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Refund</CardTitle>
      </CardHeader>
      <CardContent className="gap-3">
        <View className="flex-row items-center rounded border border-border bg-background">
          <View className="items-center justify-center border-r border-border px-3 py-2">
            <Text>{sale.currency_symbol}</Text>
          </View>
          <TextInput
            className="flex-1 px-3 py-2 font-sans text-base text-foreground"
            placeholder={sale.amount_refundable_in_currency}
            placeholderTextColor={mutedColor}
            value={refundAmountInput}
            onChangeText={setRefundAmountInput}
            keyboardType="decimal-pad"
            editable={!isRefunding}
          />
        </View>

        {refundError && <Text className="text-sm text-destructive">{refundError}</Text>}

        <Button onPress={handleRefund} disabled={isRefunding}>
          {isRefunding ? <LoadingSpinner size="small" /> : <Text>{buttonText}</Text>}
        </Button>

        {!sale.refund_fee_notice_shown && (
          <View className="rounded bg-blue-100 p-3 dark:bg-blue-900/30">
            <Text className="text-sm text-blue-700 dark:text-blue-300">
              Going forward, Gumroad does not return the payment processor fees when a payment is refunded.{" "}
              <Text
                className="text-sm text-blue-700 underline dark:text-blue-300"
                onPress={() => Linking.openURL(REFUND_FEE_HELP_URL)}
              >
                Learn more
              </Text>
            </Text>
          </View>
        )}
      </CardContent>
    </Card>
  );
};
