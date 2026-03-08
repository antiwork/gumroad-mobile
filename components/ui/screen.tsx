import { View, ViewProps } from "react-native";
import { UpdateBanner } from "../update-banner";

export const Screen = ({ children, ...props }: ViewProps) => (
  <View {...props} className="flex-1 border-t border-border bg-body-bg">
    <UpdateBanner />
    {children}
  </View>
);
