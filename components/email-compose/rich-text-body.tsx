import { useCSSVariable } from "uniwind";
import {
  LinkBridge,
  PlaceholderBridge,
  RichText,
  TenTapStartKit,
  Toolbar,
  useEditorBridge,
  type EditorBridge,
} from "@10play/tentap-editor";
import { useEffect, useState } from "react";
import { Keyboard, Platform, View } from "react-native";

const useKeyboardHeight = () => {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, (e) => setHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener(hideEvent, () => setHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);
  return height;
};

export const useRichTextBody = ({
  initialHtml,
  onChange,
}: {
  initialHtml: string;
  onChange: (html: string) => void;
}): EditorBridge => {
  const foreground = useCSSVariable("--color-foreground");
  const bodyBg = useCSSVariable("--color-body-bg");

  const editor = useEditorBridge({
    initialContent: initialHtml,
    autofocus: true,
    avoidIosKeyboard: true,
    bridgeExtensions: [
      ...TenTapStartKit,
      PlaceholderBridge.configureExtension({ placeholder: "Write your message…" }),
      LinkBridge.configureExtension({ openOnClick: false }),
    ],
  });

  useEffect(() => {
    const css = `
      body {
        color: ${foreground};
        background-color: ${bodyBg};
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif;
        font-size: 16px;
        line-height: 1.5;
        padding: 12px 16px;
      }
      .is-editor-empty:first-child::before {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif;
      }
      img { max-width: 100%; height: auto; max-height: 200px; object-fit: contain; display: block; margin: 8px 0; border-radius: 6px; }
    `;
    editor.injectCSS(css, "email-compose-theme");
  }, [editor, foreground, bodyBg]);

  useEffect(() => {
    const unsubscribe = editor._subscribeToEditorStateUpdate(async () => {
      const html = await editor.getHTML();
      onChange(html);
    });
    return unsubscribe;
  }, [editor, onChange]);

  return editor;
};

export const RichTextBody = ({ editor }: { editor: EditorBridge }) => {
  const keyboardHeight = useKeyboardHeight();
  return (
    <>
      <View className="flex-1">
        <RichText editor={editor} />
      </View>
      <View style={{ position: "absolute", left: 0, right: 0, bottom: keyboardHeight }}>
        <Toolbar editor={editor} hidden={false} />
      </View>
    </>
  );
};
