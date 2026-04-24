import { View, ViewProps } from "react-native";

type Props = ViewProps & {
  actions?: unknown;
  onPress?: unknown;
  dropdownMenuMode?: boolean;
  previewBackgroundColor?: string;
};

const ContextMenu = ({ children, actions: _actions, onPress: _onPress, dropdownMenuMode: _d, previewBackgroundColor: _p, ...rest }: Props) => (
  <View {...rest}>{children}</View>
);

export default ContextMenu;
