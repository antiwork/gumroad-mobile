import { HStack, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import { bold, font, foregroundStyle, frame, padding } from "@expo/ui/swift-ui/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";

type RevenueWidgetProps = {
  today: string;
  week: string;
  month: string;
  year: string;
  isLoggedIn: boolean;
  hasError: boolean;
};

const RevenueRow = ({ label, value }: { label: string; value: string }) => (
  <HStack>
    <Text modifiers={[font({ size: 13 }), foregroundStyle({ type: "hierarchical", style: "primary" })]}>{label}</Text>
    <Spacer />
    <Text modifiers={[font({ size: 13 }), bold(), foregroundStyle({ type: "hierarchical", style: "primary" })]}>{value}</Text>
  </HStack>
);

const RevenueWidget = (props: RevenueWidgetProps, _environment: WidgetEnvironment) => {
  "widget";

  if (!props.isLoggedIn) {
    return (
      <VStack modifiers={[padding()]}>
        <HStack spacing={4} alignment="center">
          <Text modifiers={[font({ size: 13 }), bold(), foregroundStyle({ type: "hierarchical", style: "primary" })]}>
            Open Gumroad to log in
          </Text>
        </HStack>
      </VStack>
    );
  }

  if (props.hasError) {
    return (
      <VStack alignment="center" modifiers={[padding({ all: 16 })]}>
        <Spacer />
        <Text modifiers={[font({ size: 13 }), foregroundStyle({ type: "hierarchical", style: "primary" })]}>
          Sorry, something went wrong. Try again later.
        </Text>
        <Spacer />
      </VStack>
    );
  }

  return (
    <VStack alignment="leading" modifiers={[padding({ vertical: 16, horizontal: 14 })]}>
      <HStack spacing={5} alignment="center">
        <Text modifiers={[font({ size: 15 }), bold(), foregroundStyle({ type: "hierarchical", style: "primary" })]}>
          Gumroad Totals
        </Text>
      </HStack>
      <Spacer modifiers={[frame({ height: 16 })]} />
      <VStack spacing={8}>
        <RevenueRow label="Today" value={props.today} />
        <RevenueRow label="Week" value={props.week} />
        <RevenueRow label="Month" value={props.month} />
        <RevenueRow label="Year" value={props.year} />
      </VStack>
      <Spacer />
    </VStack>
  );
};

export default createWidget("RevenueWidget", RevenueWidget);
