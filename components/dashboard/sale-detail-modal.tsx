import { RefundForm } from "@/components/dashboard/refund-form";
import {
  MissedPost,
  saleActions,
  useMissedPosts,
  useSaleAction,
  useSaleOptions,
} from "@/components/dashboard/use-sale-actions";
import {
  CustomerDetail,
  refundSale,
  SaleCharge,
  SaleDetail,
  SaleEmail,
  useSaleDetail,
} from "@/components/dashboard/use-sales-analytics";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { assertDefined } from "@/lib/assert";
import { safeOpenURL } from "@/lib/open-url";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { Alert, KeyboardTypeOptions, Modal, Pressable, ScrollView, Switch, TextInput, View } from "react-native";
import { useCSSVariable } from "uniwind";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

const MEMBERSHIP_STATUS_LABELS: Record<string, string> = {
  alive: "Active",
  cancelled: "Cancelled",
  failed_payment: "Failed payment",
  fixed_subscription_period_ended: "Ended",
  pending_cancellation: "Cancellation pending",
  pending_failure: "Failure pending",
};

const INSTALLMENT_PLAN_STATUS_LABELS: Record<string, string> = {
  alive: "In progress",
  cancelled: "Cancelled",
  failed_payment: "Payment failed",
  fixed_subscription_period_ended: "Paid in full",
  pending_cancellation: "Cancellation pending",
  pending_failure: "Failure pending",
};

type SaleAction = ReturnType<typeof useSaleAction>;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

const formatDiscount = (discount: NonNullable<CustomerDetail["discount"]>, currencySymbol: string) =>
  discount.type === "fixed" ? `${currencySymbol}${(discount.cents / 100).toFixed(2)}` : `${discount.percents}%`;

type PromptConfig = {
  title: string;
  message: string;
  defaultValue: string;
  keyboardType?: KeyboardTypeOptions;
  onSubmit: (value: string) => void;
};

type PromptFn = (config: PromptConfig) => void;

const usePrompt = () => {
  const [config, setConfig] = useState<PromptConfig | null>(null);
  const prompt = useCallback<PromptFn>((next) => setConfig(next), []);
  const close = useCallback(() => setConfig(null), []);
  return { prompt, config, close };
};

const PromptModal = ({ config, onClose }: { config: PromptConfig | null; onClose: () => void }) => {
  const [value, setValue] = useState("");
  const mutedColor = useCSSVariable("--color-muted") as string;

  useEffect(() => {
    if (config) setValue(config.defaultValue);
  }, [config]);

  const save = () => {
    config?.onSubmit(value);
    onClose();
  };

  return (
    <Modal visible={!!config} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 items-center justify-center bg-black/50 p-6" onPress={onClose}>
        <Pressable className="w-full max-w-md gap-4 rounded-lg border border-border bg-card p-4" onPress={() => {}}>
          <View className="gap-1">
            <Text className="text-lg font-bold">{config?.title}</Text>
            <Text className="text-sm text-muted">{config?.message}</Text>
          </View>
          <TextInput
            className="rounded border border-border px-3 py-2 font-sans text-base text-foreground"
            placeholderTextColor={mutedColor}
            keyboardType={config?.keyboardType ?? "default"}
            value={value}
            onChangeText={setValue}
            autoFocus
          />
          <View className="flex-row justify-end gap-2">
            <Button variant="outline" size="sm" onPress={onClose}>
              <Text>Cancel</Text>
            </Button>
            <Button size="sm" onPress={save}>
              <Text>Save</Text>
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const InfoRow = ({
  label,
  value,
  last,
  onPress,
}: {
  label: string;
  value: string;
  last?: boolean;
  onPress?: () => void;
}) => (
  <CardContent className={`flex-row justify-between gap-4 ${last ? "" : "border-b border-border"}`}>
    <Text className="font-bold">{label}</Text>
    <Text className={`flex-1 text-right ${onPress ? "text-accent underline" : ""}`} numberOfLines={3} onPress={onPress}>
      {value}
    </Text>
  </CardContent>
);

const StatusBadges = ({ sale, customer }: { sale: SaleDetail; customer?: CustomerDetail }) => {
  const badges: { label: string; destructive?: boolean }[] = [];
  if (sale.chargedback) badges.push({ label: "Chargedback", destructive: true });
  else if (sale.refunded) badges.push({ label: "Refunded" });
  else if (sale.partially_refunded) badges.push({ label: "Partially refunded" });
  if (customer?.is_access_revoked === true) badges.push({ label: "Access revoked", destructive: true });
  if (customer?.is_preorder) badges.push({ label: "Preorder" });
  if (customer?.is_additional_contribution) badges.push({ label: "Additional contribution" });
  if (customer?.giftee_email) badges.push({ label: "Gift" });
  if (badges.length === 0) return null;
  return (
    <View className="flex-row flex-wrap gap-2">
      {badges.map((badge) => (
        <Badge key={badge.label} variant={badge.destructive ? "destructive" : "outline"}>
          <Text>{badge.label}</Text>
        </Badge>
      ))}
    </View>
  );
};

const EmailCard = ({
  sale,
  customer,
  action,
  prompt,
}: {
  sale: SaleDetail;
  customer?: CustomerDetail;
  action: SaleAction;
  prompt: PromptFn;
}) => {
  const serverCanContact = customer?.can_contact;
  const [canContact, setCanContact] = useState(serverCanContact ?? false);

  useEffect(() => {
    if (serverCanContact !== undefined) setCanContact(serverCanContact);
  }, [serverCanContact]);

  const editEmail = () =>
    prompt({
      title: "Edit email",
      message: "New email for this customer",
      defaultValue: customer?.email ?? sale.purchase_email,
      keyboardType: "email-address",
      onSubmit: (email) =>
        action.run((token) => saleActions.updateSale(sale.purchase_id, { email }, token), {
          successMessage: "Email updated successfully.",
        }),
    });
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Email</CardTitle>
        {customer && !customer.is_existing_user && (
          <Text className="text-sm text-accent underline" onPress={editEmail}>
            Edit
          </Text>
        )}
      </CardHeader>
      <CardContent className="border-b border-border">
        <Text className="font-bold" selectable>
          {customer?.email ?? sale.purchase_email}
        </Text>
      </CardContent>
      {customer?.is_existing_user && <InfoRow label="Gumroad account" value="Yes" />}
      {customer && (
        <CardContent className="flex-row items-center justify-between">
          <Text className="font-bold">Receives emails</Text>
          <Switch
            value={canContact}
            disabled={action.isBusy}
            onValueChange={(value) => {
              setCanContact(value);
              action.run((token) => saleActions.changeCanContact(sale.purchase_id, value, token)).then((ok) => {
                if (!ok) setCanContact(!value);
              });
            }}
          />
        </CardContent>
      )}
    </Card>
  );
};

const GifteeCard = ({
  sale,
  customer,
  action,
  prompt,
}: {
  sale: SaleDetail;
  customer: CustomerDetail;
  action: SaleAction;
  prompt: PromptFn;
}) => {
  if (!customer.giftee_email) return null;
  const editGiftee = () =>
    prompt({
      title: "Edit giftee email",
      message: "New email for the gift recipient",
      defaultValue: customer.giftee_email ?? "",
      keyboardType: "email-address",
      onSubmit: (email) =>
        action.run((token) => saleActions.updateSale(sale.purchase_id, { giftee_email: email }, token), {
          successMessage: "Email updated successfully.",
        }),
    });
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Giftee email</CardTitle>
        <Text className="text-sm text-accent underline" onPress={editGiftee}>
          Edit
        </Text>
      </CardHeader>
      <CardContent>
        <Text className="font-bold" selectable>
          {customer.giftee_email}
        </Text>
      </CardContent>
    </Card>
  );
};

const OrderCard = ({
  sale,
  customer,
  action,
  prompt,
}: {
  sale: SaleDetail;
  customer?: CustomerDetail;
  action: SaleAction;
  prompt: PromptFn;
}) => {
  const [showOptions, setShowOptions] = useState(false);
  const { data: options, isLoading: isLoadingOptions } = useSaleOptions(sale.purchase_id, showOptions);

  const editSeats = () =>
    prompt({
      title: "Edit seats",
      message: "Number of seats",
      defaultValue: String(sale.quantity),
      keyboardType: "number-pad",
      onSubmit: (value) => {
        const quantity = parseInt(value, 10);
        if (quantity > 0) action.run((token) => saleActions.updateSale(sale.purchase_id, { quantity }, token));
      },
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Order information</CardTitle>
      </CardHeader>
      <InfoRow label="Order number" value={customer?.physical?.order_number ?? String(sale.order_id)} />
      {!!sale.formatted_total_price && <InfoRow label="Price" value={sale.formatted_total_price} />}
      {!!customer?.price.tip_cents && (
        <InfoRow label="Tip" value={`${sale.currency_symbol}${(customer.price.tip_cents / 100).toFixed(2)}`} />
      )}
      {customer?.is_multiseat_license ? (
        <InfoRow label="Seats" value={String(sale.quantity)} onPress={editSeats} />
      ) : (
        <InfoRow label="Quantity" value={String(sale.quantity)} />
      )}
      {!!sale.purchase_daystamp && <InfoRow label="Date" value={sale.purchase_daystamp} />}
      {!!customer?.physical?.sku && <InfoRow label="SKU" value={customer.physical.sku} />}
      {!!customer?.has_options && (
        <InfoRow label="Version" value={customer.option?.name ?? "None"} onPress={() => setShowOptions(!showOptions)} />
      )}
      {showOptions &&
        (isLoadingOptions ? (
          <CardContent>
            <LoadingSpinner size="small" />
          </CardContent>
        ) : (
          (options ?? []).map((option) => (
            <CardContent key={option.id} className="border-b border-border">
              <Text
                className={option.id === customer?.option?.id ? "font-bold" : "text-accent underline"}
                onPress={() => {
                  setShowOptions(false);
                  if (option.id !== customer?.option?.id) {
                    action.run((token) => saleActions.updateVariant(sale.purchase_id, option.id, sale.quantity, token));
                  }
                }}
              >
                {option.name}
              </Text>
            </CardContent>
          ))
        ))}
      {!!customer?.discount && (
        <InfoRow
          label="Discount"
          value={`${customer.discount.code} (${formatDiscount(customer.discount, sale.currency_symbol)} off)`}
        />
      )}
      {!!customer?.upsell && <InfoRow label="Upsell" value={customer.upsell} />}
      {!!customer?.referrer && <InfoRow label="Referrer" value={customer.referrer} />}
      {!!customer?.ppp && (
        <InfoRow
          label="Purchasing power parity"
          value={`${customer.ppp.discount} off (${customer.ppp.country ?? "unknown"})`}
        />
      )}
      {customer?.download_count !== null && customer?.download_count !== undefined && (
        <InfoRow label="Downloads" value={String(customer.download_count)} />
      )}
      {customer?.transaction_url_for_seller ? (
        <InfoRow
          label="Transaction"
          value="View on processor"
          onPress={() => safeOpenURL(assertDefined(customer.transaction_url_for_seller))}
          last
        />
      ) : (
        <InfoRow label="Product" value={customer?.product.name ?? sale.name} last />
      )}
    </Card>
  );
};

const ContentCard = ({
  productPurchases,
  onSelectSale,
}: {
  productPurchases: CustomerDetail[];
  onSelectSale: (id: string) => void;
}) => {
  if (productPurchases.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Content</CardTitle>
      </CardHeader>
      {productPurchases.map((productPurchase, index) => (
        <CardContent
          key={productPurchase.id}
          className={`flex-row items-center justify-between gap-2 ${index === productPurchases.length - 1 ? "" : "border-b border-border"}`}
        >
          <Text className="flex-1 font-bold" numberOfLines={1}>
            {productPurchase.product.name}
          </Text>
          <Text className="text-accent underline" onPress={() => onSelectSale(productPurchase.id)}>
            Manage
          </Text>
        </CardContent>
      ))}
    </Card>
  );
};

const FileRows = ({
  files,
  action,
}: {
  files: { id: string; name: string; size: number; extension: string; key: string }[];
  action: SaleAction;
}) => (
  <>
    {files.map((file, index) => (
      <CardContent
        key={file.id}
        className={`flex-row items-center justify-between gap-2 ${index === files.length - 1 ? "" : "border-b border-border"}`}
      >
        <Text className="flex-1" numberOfLines={1}>
          {file.name}.{file.extension.toLowerCase()} ({(file.size / 1024).toFixed(0)} KB)
        </Text>
        <Text
          className="text-accent underline"
          onPress={() =>
            action.run(
              async (token) => {
                const result = await saleActions.blobUrl(file.key, token);
                if (result.url) safeOpenURL(result.url);
                return result;
              },
              { skipRefetch: true },
            )
          }
        >
          Download
        </Text>
      </CardContent>
    ))}
  </>
);

const CustomFieldsCard = ({ customer, action }: { customer: CustomerDetail; action: SaleAction }) => {
  if (customer.custom_fields.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Information provided</CardTitle>
      </CardHeader>
      {customer.custom_fields.map((field, index) =>
        field.type === "text" ? (
          <InfoRow
            key={field.attribute}
            label={field.attribute}
            value={field.value}
            last={index === customer.custom_fields.length - 1}
          />
        ) : (
          <View key={field.attribute}>
            <CardContent className="border-b border-border">
              <Text className="font-bold">{field.attribute}</Text>
            </CardContent>
            <FileRows files={field.files} action={action} />
          </View>
        ),
      )}
    </Card>
  );
};

const UtmLinkCard = ({ customer }: { customer: CustomerDetail }) => {
  const utmLink = customer.utm_link;
  if (!utmLink) return null;
  const rows = [
    { label: "Title", value: utmLink.title },
    { label: "Source", value: utmLink.source ?? "" },
    { label: "Medium", value: utmLink.medium ?? "" },
    { label: "Campaign", value: utmLink.campaign ?? "" },
    { label: "Term", value: utmLink.term ?? "" },
    { label: "Content", value: utmLink.content ?? "" },
  ].filter((row) => row.value);
  return (
    <Card>
      <CardHeader>
        <CardTitle>UTM link</CardTitle>
      </CardHeader>
      {rows.map((row, index) => (
        <InfoRow key={row.label} label={row.label} value={row.value} last={index === rows.length - 1} />
      ))}
    </Card>
  );
};

const MembershipCard = ({ customer, action }: { customer: CustomerDetail; action: SaleAction }) => {
  const subscription = customer.subscription;
  if (!subscription) return null;
  const isInstallmentPlan = subscription.is_installment_plan;
  const labels = isInstallmentPlan ? INSTALLMENT_PLAN_STATUS_LABELS : MEMBERSHIP_STATUS_LABELS;
  const entity = isInstallmentPlan ? "installment plan" : "membership";
  const cancellable = subscription.status === "alive" || subscription.status === "pending_failure";

  const confirmCancel = () =>
    Alert.alert(`Cancel ${entity}`, `Are you sure you want to cancel this ${entity}?`, [
      { text: "No", style: "cancel" },
      {
        text: "Yes, cancel",
        style: "destructive",
        onPress: () => action.run((token) => saleActions.cancelSubscription(subscription.id, token)),
      },
    ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isInstallmentPlan ? "Installment plan" : "Membership"}</CardTitle>
      </CardHeader>
      {!!subscription.status && (
        <InfoRow
          label="Status"
          value={labels[subscription.status] ?? subscription.status}
          last={subscription.remaining_charges === null && !cancellable}
        />
      )}
      {subscription.remaining_charges !== null && (
        <InfoRow label="Remaining charges" value={String(subscription.remaining_charges)} last={!cancellable} />
      )}
      {cancellable && (
        <CardContent>
          <Button variant="destructive" size="sm" onPress={confirmCancel} disabled={action.isBusy}>
            <Text>Cancel {entity}</Text>
          </Button>
        </CardContent>
      )}
    </Card>
  );
};

const ChargesCard = ({ charges, action }: { charges: SaleCharge[]; action: SaleAction }) => {
  const queryClient = useQueryClient();
  if (charges.length === 0) return null;

  const refundCharge = (charge: SaleCharge) =>
    Alert.alert("Refund charge", `Refund the ${formatDate(charge.created_at)} charge in full?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm refund",
        style: "destructive",
        onPress: () =>
          action.run(async (token) => {
            const result = await refundSale({ purchaseId: charge.id, accessToken: token });
            queryClient.invalidateQueries({ queryKey: ["analytics"] });
            return result;
          }),
      },
    ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Charges</CardTitle>
      </CardHeader>
      {charges.map((charge, index) => (
        <CardContent
          key={charge.id}
          className={`flex-row items-center justify-between gap-2 ${index === charges.length - 1 ? "" : "border-b border-border"}`}
        >
          <Text>{formatDate(charge.created_at)}</Text>
          <View className="flex-row items-center gap-2">
            {charge.is_upgrade_purchase && (
              <Badge variant="outline">
                <Text>Upgrade</Text>
              </Badge>
            )}
            {charge.chargedback ? (
              <Badge variant="destructive">
                <Text>Chargedback</Text>
              </Badge>
            ) : charge.refunded ? (
              <Badge variant="outline">
                <Text>Refunded</Text>
              </Badge>
            ) : charge.partially_refunded ? (
              <Badge variant="outline">
                <Text>Partially refunded</Text>
              </Badge>
            ) : parseFloat(charge.amount_refundable) > 0 ? (
              <Text className="text-accent underline" onPress={() => refundCharge(charge)}>
                Refund
              </Text>
            ) : null}
          </View>
        </CardContent>
      ))}
    </Card>
  );
};

const EmailsCard = ({ sale, emails, action }: { sale: SaleDetail; emails: SaleEmail[]; action: SaleAction }) => {
  if (emails.length === 0) return null;
  const resend = (email: SaleEmail) =>
    action.run(
      (token) =>
        email.type === "receipt"
          ? saleActions.resendReceipt(email.id, token)
          : saleActions.sendPost(sale.purchase_id, email.id, token),
      { successMessage: email.type === "receipt" ? "Receipt resent" : "Post resent", skipRefetch: true },
    );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Emails received</CardTitle>
      </CardHeader>
      {emails.map((email, index) => (
        <CardContent
          key={`${email.type}-${email.id}-${index}`}
          className={`flex-row items-center justify-between gap-2 ${index === emails.length - 1 ? "" : "border-b border-border"}`}
        >
          <View className="flex-1 gap-1">
            <Text
              className="font-bold"
              numberOfLines={1}
              onPress={email.url ? () => safeOpenURL(assertDefined(email.url)) : undefined}
            >
              {email.name}
            </Text>
            <Text className="text-sm">
              {email.state}
              {email.state_at ? ` · ${formatDate(email.state_at)}` : ""}
            </Text>
          </View>
          <Text className="text-accent underline" onPress={() => resend(email)}>
            Resend
          </Text>
        </CardContent>
      ))}
    </Card>
  );
};

const MissedPostsCard = ({ sale, action }: { sale: SaleDetail; action: SaleAction }) => {
  const { data: missedPosts } = useMissedPosts(sale.purchase_id);
  const [sentPostIds, setSentPostIds] = useState<string[]>([]);
  if (!missedPosts || missedPosts.length === 0) return null;

  const send = (post: MissedPost) =>
    action
      .run((token) => saleActions.sendPost(sale.purchase_id, post.id, token), { skipRefetch: true })
      .then((ok) => {
        if (ok) setSentPostIds((ids) => [...ids, post.id]);
      });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Send missed posts</CardTitle>
      </CardHeader>
      {missedPosts.map((post, index) => (
        <CardContent
          key={post.id}
          className={`flex-row items-center justify-between gap-2 ${index === missedPosts.length - 1 ? "" : "border-b border-border"}`}
        >
          <View className="flex-1 gap-1">
            <Text className="font-bold" numberOfLines={1}>
              {post.name}
            </Text>
            {!!post.published_at && <Text className="text-sm">{formatDate(post.published_at)}</Text>}
          </View>
          {sentPostIds.includes(post.id) ? (
            <Text className="text-muted">Sent</Text>
          ) : (
            <Text className="text-accent underline" onPress={() => send(post)}>
              Send
            </Text>
          )}
        </CardContent>
      ))}
    </Card>
  );
};

const ShippingCard = ({
  sale,
  customer,
  action,
  prompt,
}: {
  sale: SaleDetail;
  customer: CustomerDetail;
  action: SaleAction;
  prompt: PromptFn;
}) => {
  const shipping = customer.shipping;
  const [isEditing, setEditing] = useState(false);
  const [address, setAddress] = useState(shipping?.address ?? null);
  const mutedColor = useCSSVariable("--color-muted") as string;
  if (!shipping || !address) return null;

  const saveAddress = () =>
    action
      .run((token) =>
        saleActions.updateSale(
          sale.purchase_id,
          {
            full_name: address.full_name,
            street_address: address.street_address,
            city: address.city,
            state: address.state,
            zip_code: address.zip_code,
            country: address.country,
          },
          token,
        ),
      )
      .then((ok) => ok && setEditing(false));

  const markShipped = () =>
    prompt({
      title: "Mark as shipped",
      message: "Tracking URL (optional)",
      defaultValue: shipping.tracking.url ?? "",
      keyboardType: "url",
      onSubmit: (trackingUrl) =>
        action.run((token) => saleActions.markAsShipped(sale.purchase_id, trackingUrl.trim() || null, token)),
    });

  const fields: { key: keyof typeof address; placeholder: string }[] = [
    { key: "full_name", placeholder: "Full name" },
    { key: "street_address", placeholder: "Street address" },
    { key: "city", placeholder: "City" },
    { key: "state", placeholder: "State" },
    { key: "zip_code", placeholder: "ZIP code" },
    { key: "country", placeholder: "Country" },
  ];

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Shipping address</CardTitle>
        <Badge variant="outline">
          <Text>{shipping.tracking.shipped ? "Shipped" : "Not shipped"}</Text>
        </Badge>
      </CardHeader>
      {isEditing ? (
        <CardContent className="gap-2 border-b border-border">
          {fields.map((field) => (
            <TextInput
              key={field.key}
              className="rounded border border-border px-3 py-2 font-sans text-base text-foreground"
              placeholder={field.placeholder}
              placeholderTextColor={mutedColor}
              value={address[field.key]}
              onChangeText={(value) => setAddress({ ...address, [field.key]: value })}
            />
          ))}
          <Button size="sm" onPress={saveAddress} disabled={action.isBusy}>
            <Text>Save address</Text>
          </Button>
        </CardContent>
      ) : (
        <CardContent className="border-b border-border">
          <View className="flex-row items-start justify-between gap-2">
            <View className="flex-1">
              <Text className="font-bold">{address.full_name}</Text>
              <Text>{address.street_address}</Text>
              <Text>
                {address.city}, {address.state} {address.zip_code}
              </Text>
              <Text>{address.country}</Text>
            </View>
            <Text className="text-accent underline" onPress={() => setEditing(true)}>
              Edit
            </Text>
          </View>
        </CardContent>
      )}
      <InfoRow
        label="Shipping price"
        value={shipping.price}
        last={shipping.tracking.shipped && !shipping.tracking.url}
      />
      {shipping.tracking.shipped ? (
        shipping.tracking.url ? (
          <CardContent>
            <Text className="text-accent underline" onPress={() => safeOpenURL(assertDefined(shipping.tracking.url))}>
              Track shipment
            </Text>
          </CardContent>
        ) : null
      ) : (
        <CardContent>
          <Button size="sm" onPress={markShipped} disabled={action.isBusy}>
            <Text>Mark as shipped</Text>
          </Button>
        </CardContent>
      )}
    </Card>
  );
};

const LicenseCard = ({ customer, action }: { customer: CustomerDetail; action: SaleAction }) => {
  const license = customer.license;
  if (!license) return null;

  const toggleLicense = () => {
    const run = () => action.run((token) => saleActions.updateLicense(license.id, !license.enabled, token));
    if (!license.enabled) {
      run();
      return;
    }
    Alert.alert("Disable license", "Are you sure you want to disable this license key?", [
      { text: "Cancel", style: "cancel" },
      { text: "Disable license", style: "destructive", onPress: run },
    ]);
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>License key</CardTitle>
        {!license.enabled && (
          <Badge variant="destructive">
            <Text>Disabled</Text>
          </Badge>
        )}
      </CardHeader>
      <CardContent className="border-b border-border">
        <Text className="font-bold" selectable>
          {license.key}
        </Text>
      </CardContent>
      <InfoRow label="Uses" value={String(license.uses)} />
      <CardContent>
        <Button
          variant={license.enabled ? "destructive" : "default"}
          size="sm"
          disabled={action.isBusy}
          onPress={toggleLicense}
        >
          <Text>{license.enabled ? "Disable license" : "Enable license"}</Text>
        </Button>
      </CardContent>
    </Card>
  );
};

const AccessCard = ({ sale, customer, action }: { sale: SaleDetail; customer: CustomerDetail; action: SaleAction }) => {
  if (customer.is_access_revoked === null) return null;

  const confirmRevoke = () =>
    Alert.alert("Revoke access", "Are you sure you want to revoke this customer's access?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Revoke access",
        style: "destructive",
        onPress: () => action.run((token) => saleActions.revokeAccess(sale.purchase_id, token)),
      },
    ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Access</CardTitle>
      </CardHeader>
      <CardContent>
        {customer.is_access_revoked ? (
          <Button
            size="sm"
            disabled={action.isBusy}
            onPress={() => action.run((token) => saleActions.undoRevokeAccess(sale.purchase_id, token))}
          >
            <Text>Re-enable access</Text>
          </Button>
        ) : (
          <Button variant="destructive" size="sm" disabled={action.isBusy} onPress={confirmRevoke}>
            <Text>Revoke access</Text>
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

const CallCard = ({ customer, action, prompt }: { customer: CustomerDetail; action: SaleAction; prompt: PromptFn }) => {
  const call = customer.call;
  if (!call) return null;
  const editUrl = () =>
    prompt({
      title: "Edit call URL",
      message: "URL for joining the call",
      defaultValue: call.call_url ?? "",
      keyboardType: "url",
      onSubmit: (callUrl) => action.run((token) => saleActions.updateCallUrl(call.id, callUrl, token)),
    });
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Call</CardTitle>
        <Text className="text-sm text-accent underline" onPress={editUrl}>
          Edit URL
        </Text>
      </CardHeader>
      <InfoRow label="Starts" value={new Date(call.start_time).toLocaleString()} />
      <InfoRow label="Ends" value={new Date(call.end_time).toLocaleString()} last={!call.call_url} />
      {!!call.call_url && (
        <CardContent>
          <Text className="text-accent underline" onPress={() => safeOpenURL(assertDefined(call.call_url))}>
            {call.call_url}
          </Text>
        </CardContent>
      )}
    </Card>
  );
};

const CommissionCard = ({ customer, action }: { customer: CustomerDetail; action: SaleAction }) => {
  const commission = customer.commission;
  if (!commission) return null;
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Commission</CardTitle>
        <Badge variant="outline">
          <Text>{commission.status.replace(/_/g, " ")}</Text>
        </Badge>
      </CardHeader>
      {commission.files.length > 0 ? (
        <FileRows files={commission.files} action={action} />
      ) : (
        <CardContent className={commission.status === "in_progress" ? "border-b border-border" : ""}>
          <Text className="text-muted">No files</Text>
        </CardContent>
      )}
      {commission.status === "in_progress" && (
        <CardContent>
          <Button
            size="sm"
            disabled={action.isBusy}
            onPress={() => action.run((token) => saleActions.completeCommission(commission.id, token))}
          >
            <Text>Mark as complete</Text>
          </Button>
        </CardContent>
      )}
    </Card>
  );
};

const ReviewCard = ({
  sale,
  customer,
  action,
  prompt,
}: {
  sale: SaleDetail;
  customer: CustomerDetail;
  action: SaleAction;
  prompt: PromptFn;
}) => {
  const review = customer.review;
  if (!review) return null;

  const editResponse = () =>
    prompt({
      title: "Respond to review",
      message: "Your public response",
      defaultValue: review.response?.message ?? "",
      onSubmit: (message) => action.run((token) => saleActions.updateReviewResponse(sale.purchase_id, message, token)),
    });
  const deleteResponse = () =>
    Alert.alert("Delete response", "Remove your response to this review?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => action.run((token) => saleActions.deleteReviewResponse(sale.purchase_id, token)),
      },
    ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review</CardTitle>
      </CardHeader>
      <CardContent className="gap-1 border-b border-border">
        <Text className="font-bold">
          {"★".repeat(review.rating)}
          {"☆".repeat(Math.max(0, 5 - review.rating))}
        </Text>
        {!!review.message && <Text>{review.message}</Text>}
      </CardContent>
      {review.videos.map((video) => (
        <CardContent key={video.id} className="flex-row items-center justify-between gap-2 border-b border-border">
          <Text className="flex-1">Video review ({video.approval_status.replace(/_/g, " ")})</Text>
          <View className="flex-row gap-3">
            {video.can_approve && (
              <Text
                className="text-accent underline"
                onPress={() => action.run((token) => saleActions.approveReviewVideo(video.id, token))}
              >
                Approve
              </Text>
            )}
            {video.can_reject && (
              <Text
                className="text-destructive underline"
                onPress={() => action.run((token) => saleActions.rejectReviewVideo(video.id, token))}
              >
                Reject
              </Text>
            )}
          </View>
        </CardContent>
      ))}
      {review.response ? (
        <CardContent className="gap-1">
          <View className="flex-row items-center justify-between">
            <Text className="font-bold">Your response</Text>
            <View className="flex-row gap-3">
              <Text className="text-accent underline" onPress={editResponse}>
                Edit
              </Text>
              <Text className="text-destructive underline" onPress={deleteResponse}>
                Delete
              </Text>
            </View>
          </View>
          <Text>{review.response.message}</Text>
        </CardContent>
      ) : (
        <CardContent>
          <Button variant="outline" size="sm" onPress={editResponse} disabled={action.isBusy}>
            <Text>Respond to review</Text>
          </Button>
        </CardContent>
      )}
    </Card>
  );
};

export const SaleDetailModal = ({ saleId, onClose }: { saleId: string | null; onClose: () => void }) => {
  const [overrideSaleId, setOverrideSaleId] = useState<string | null>(null);
  const currentSaleId = overrideSaleId ?? saleId;
  const { data, isLoading } = useSaleDetail(currentSaleId);
  const action = useSaleAction(currentSaleId);
  const { prompt, config: promptConfig, close: closePrompt } = usePrompt();
  const sale = data?.purchase;
  const customer = data?.customer;

  useEffect(() => {
    setOverrideSaleId(null);
  }, [saleId]);

  return (
    <Sheet open={!!saleId} onOpenChange={(open) => !open && onClose()}>
      <SheetHeader onClose={onClose}>
        <SheetTitle numberOfLines={1}>{sale?.name}</SheetTitle>
      </SheetHeader>
      <SheetContent>
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <LoadingSpinner size="large" />
          </View>
        ) : sale ? (
          <ScrollView key={currentSaleId} className="flex-1" contentContainerStyle={{ padding: 16, gap: 16 }}>
            <StatusBadges sale={sale} customer={customer} />

            <EmailCard sale={sale} customer={customer} action={action} prompt={prompt} />

            {!!customer?.name && (
              <Card>
                <CardHeader>
                  <CardTitle>Full name</CardTitle>
                </CardHeader>
                <CardContent>
                  <Text className="font-bold">{customer.name}</Text>
                </CardContent>
              </Card>
            )}

            {customer && <GifteeCard sale={sale} customer={customer} action={action} prompt={prompt} />}

            <OrderCard sale={sale} customer={customer} action={action} prompt={prompt} />

            <ContentCard productPurchases={data?.product_purchases ?? []} onSelectSale={setOverrideSaleId} />

            {customer && (
              <>
                <CustomFieldsCard customer={customer} action={action} />
                <UtmLinkCard customer={customer} />
                <MembershipCard customer={customer} action={action} />
                <ChargesCard charges={data?.charges ?? []} action={action} />
                <EmailsCard sale={sale} emails={data?.emails ?? []} action={action} />
                <MissedPostsCard sale={sale} action={action} />
                <ShippingCard sale={sale} customer={customer} action={action} prompt={prompt} />
                <LicenseCard customer={customer} action={action} />
                <AccessCard sale={sale} customer={customer} action={action} />
                <CallCard customer={customer} action={action} prompt={prompt} />
                <CommissionCard customer={customer} action={action} />
                <ReviewCard sale={sale} customer={customer} action={action} prompt={prompt} />
                {!!customer.affiliate && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Affiliate</CardTitle>
                    </CardHeader>
                    <InfoRow label="Email" value={customer.affiliate.email} />
                    <InfoRow label="Commission" value={customer.affiliate.amount} last />
                  </Card>
                )}
                {data?.can_ping && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Webhook</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={action.isBusy}
                        onPress={() =>
                          action.run((token) => saleActions.resendPing(sale.purchase_id, token), {
                            successMessage: "Ping sent",
                            skipRefetch: true,
                          })
                        }
                      >
                        <Text>Resend webhook ping</Text>
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            <RefundForm sale={sale} />
          </ScrollView>
        ) : (
          <View className="flex-1 items-center justify-center">
            <Text className="font-sans text-lg text-muted">Sale not found</Text>
          </View>
        )}
      </SheetContent>
      <PromptModal config={promptConfig} onClose={closePrompt} />
    </Sheet>
  );
};
