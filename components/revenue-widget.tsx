import { HStack, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import {
  bold,
  font,
  foregroundStyle,
  frame,
  lineSpacing,
  multilineTextAlignment,
  padding,
} from "@expo/ui/swift-ui/modifiers";
import { createWidget, type WidgetEnvironment } from "expo-widgets";

type RevenueWidgetProps = {
  today: string;
  week: string;
  month: string;
  year: string;
  isLoggedIn: boolean;
  hasError: boolean;
};

const RevenueWidget = (props: RevenueWidgetProps, _environment: WidgetEnvironment) => {
  "widget";

  if (!props.isLoggedIn) {
    return (
      <VStack modifiers={[padding()]}>
        <HStack spacing={4} alignment="center">
          <Text
            modifiers={[
              font({ size: 13 }),
              bold(),
              foregroundStyle({ type: "hierarchical", style: "primary" }),
              multilineTextAlignment("center"),
              lineSpacing(4),
            ]}
          >
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
        <Text
          modifiers={[
            font({ size: 13 }),
            bold(),
            foregroundStyle({ type: "hierarchical", style: "primary" }),
            multilineTextAlignment("center"),
            lineSpacing(4),
          ]}
        >
          Sorry, something went wrong. Try again later.
        </Text>
        <Spacer />
      </VStack>
    );
  }

  return (
    <VStack alignment="leading" modifiers={[padding({ vertical: 16, horizontal: 14 })]} spacing={8}>
      <Spacer />
      <HStack spacing={5} alignment="center">
        <Text modifiers={[font({ size: 15 }), bold(), foregroundStyle({ type: "hierarchical", style: "primary" })]}>
          Gumroad Totals
        </Text>
      </HStack>
      <Spacer modifiers={[frame({ height: 1 })]} />

      <HStack>
        <Text modifiers={[font({ size: 13 }), foregroundStyle({ type: "hierarchical", style: "primary" })]}>Today</Text>
        <Spacer />
        <Text modifiers={[font({ size: 13 }), bold(), foregroundStyle({ type: "hierarchical", style: "primary" })]}>
          {props.today}
        </Text>
      </HStack>

      <HStack>
        <Text modifiers={[font({ size: 13 }), foregroundStyle({ type: "hierarchical", style: "primary" })]}>Week</Text>
        <Spacer />
        <Text modifiers={[font({ size: 13 }), bold(), foregroundStyle({ type: "hierarchical", style: "primary" })]}>
          {props.week}
        </Text>
      </HStack>

      <HStack>
        <Text modifiers={[font({ size: 13 }), foregroundStyle({ type: "hierarchical", style: "primary" })]}>Month</Text>
        <Spacer />
        <Text modifiers={[font({ size: 13 }), bold(), foregroundStyle({ type: "hierarchical", style: "primary" })]}>
          {props.month}
        </Text>
      </HStack>

      <HStack>
        <Text modifiers={[font({ size: 13 }), foregroundStyle({ type: "hierarchical", style: "primary" })]}>Year</Text>
        <Spacer />
        <Text modifiers={[font({ size: 13 }), bold(), foregroundStyle({ type: "hierarchical", style: "primary" })]}>
          {props.year}
        </Text>
      </HStack>
      <Spacer />
    </VStack>
  );
};

export default createWidget("RevenueWidget", RevenueWidget);
