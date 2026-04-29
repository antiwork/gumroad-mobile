import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { Keyboard, Platform, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export const PageIndicator = ({
  currentPage,
  totalPages,
  onJumpToPage,
}: {
  currentPage: number;
  totalPages: number;
  onJumpToPage: (page: number) => void;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<TextInput>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const { bottom: safeAreaBottom } = useSafeAreaInsets();

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, (e) => setKeyboardHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
      if (Platform.OS === "android") setIsEditing(false);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleSubmit = () => {
    const page = parseInt(inputValue, 10);
    if (page >= 1 && page <= totalPages) {
      onJumpToPage(page);
    }
    setIsEditing(false);
    Keyboard.dismiss();
  };

  return (
    <View
      pointerEvents="box-none"
      className="absolute right-0 left-0 items-center"
      style={{
        bottom:
          keyboardHeight > 0
            ? keyboardHeight + (Platform.OS === "android" ? safeAreaBottom : 0) + 8
            : safeAreaBottom + 8,
      }}
    >
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => {
          if (isEditing) {
            inputRef.current?.focus();
            return;
          }
          setInputValue(String(currentPage));
          setIsEditing(true);
          if (Platform.OS === "ios") {
            requestAnimationFrame(() => inputRef.current?.focus());
          }
        }}
      >
        <View
          className={cn(
            "flex-row items-center gap-2 rounded px-4 py-2",
            isEditing ? "bg-background" : "bg-background/70",
          )}
        >
          {isEditing ? (
            <>
              <Text className="text-lg text-muted-foreground">Jump to</Text>
              <TextInput
                ref={inputRef}
                value={inputValue}
                onChangeText={setInputValue}
                onSubmitEditing={handleSubmit}
                onBlur={() => setIsEditing(false)}
                keyboardType={Platform.OS === "ios" ? "number-pad" : "numeric"}
                returnKeyType="go"
                autoFocus={Platform.OS === "android"}
                selectTextOnFocus
                style={Platform.OS === "ios" ? { marginTop: -12, padding: 0 } : { padding: 0 }}
                className="min-w-8 text-center text-lg font-semibold text-foreground"
              />
              <Text className="text-lg font-semibold tracking-wide text-muted-foreground">/ {totalPages}</Text>
            </>
          ) : (
            <Text className="text-lg font-semibold tracking-wide">
              {currentPage} / {totalPages}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
};
