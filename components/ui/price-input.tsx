import { useCSSVariable } from "uniwind";
import { TextInput } from "react-native";

export const PriceInput = ({
  value,
  onChangeText,
  placeholder,
  testID,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  testID?: string;
}) => {
  const mutedColor = useCSSVariable("--color-muted") as string;

  return (
    <TextInput
      value={value}
      onChangeText={(raw) => onChangeText(raw.replace(/,/g, ".").replace(/[^0-9.]/g, ""))}
      placeholder={placeholder ?? "0.00"}
      placeholderTextColor={mutedColor}
      keyboardType="decimal-pad"
      className="rounded-lg border border-border bg-background px-3 py-3 text-foreground"
      testID={testID}
    />
  );
};
