import { View, ViewProps } from "react-native";

export const Screen = ({ children, ...props }: ViewProps) => (
  <View {...props} className="flex-1 border-t border-border bg-body-bg">
    {children}
  </View>
);
