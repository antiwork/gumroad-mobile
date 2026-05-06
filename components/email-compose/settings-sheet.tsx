import type { AudienceOption, AudienceType } from "@/components/email-compose/use-audience-options";
import { Banner } from "@/components/ui/banner";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { Pressable, ScrollView, View } from "react-native";

export type Channel = { email: boolean; profile: boolean };

const SectionHeader = ({ children }: { children: string }) => (
  <Text className="mb-3 text-sm font-semibold text-muted-foreground">{children}</Text>
);

const Row = ({
  control,
  label,
  description,
  onPress,
  testID,
}: {
  control: React.ReactNode;
  label: string;
  description?: string;
  onPress: () => void;
  testID?: string;
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
    testID={testID}
    className="flex-row items-center gap-3 py-3"
  >
    {control}
    <View className="flex-1">
      <Text className="text-base">{label}</Text>
      {description ? <Text className="text-sm text-muted-foreground">{description}</Text> : null}
    </View>
  </Pressable>
);

export const SettingsSheet = ({
  open,
  onClose,
  options,
  audienceType,
  onSelectAudience,
  hasProfileSections,
  channel,
  onChangeChannel,
  allowComments,
  onChangeAllowComments,
}: {
  open: boolean;
  onClose: () => void;
  options: AudienceOption[];
  audienceType: AudienceType;
  onSelectAudience: (type: AudienceType) => void;
  hasProfileSections: boolean;
  channel: Channel;
  onChangeChannel: (next: Channel) => void;
  allowComments: boolean;
  onChangeAllowComments: (next: boolean) => void;
}) => {
  const profileVisible = audienceType === "audience";
  const showNoSectionsBanner = profileVisible && channel.profile && !hasProfileSections;
  const canDisableEmail = channel.profile;
  const canDisableProfile = channel.email;

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <SheetHeader onClose={onClose}>
        <SheetTitle>Settings</SheetTitle>
      </SheetHeader>
      <SheetContent>
        <ScrollView contentContainerClassName="pb-8">
          <View className="px-4 py-4">
            <SectionHeader>Audience</SectionHeader>
            <RadioGroup value={audienceType} onValueChange={(v) => onSelectAudience(v as AudienceType)}>
              {options.map((option) => (
                <Pressable
                  key={option.type}
                  onPress={() => onSelectAudience(option.type)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: option.type === audienceType }}
                  accessibilityLabel={`${option.label}, ${option.count} recipients`}
                  className="flex-row items-center gap-3 py-3"
                >
                  <RadioGroupItem value={option.type} aria-labelledby={`audience-${option.type}`} />
                  <View className="flex-1">
                    <Text className="text-base">{option.label}</Text>
                    <Text className="text-sm text-muted-foreground">
                      {option.count.toLocaleString()} {option.count === 1 ? "recipient" : "recipients"}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </RadioGroup>
          </View>

          <View className="border-t border-border" />

          <View className="px-4 py-4">
            <SectionHeader>Channel</SectionHeader>
            <Row
              control={
                <Checkbox
                  checked={channel.email}
                  disabled={!canDisableProfile && channel.email}
                  onCheckedChange={(next) => onChangeChannel({ ...channel, email: next })}
                  testID="channel-email-checkbox"
                />
              }
              label="Send email"
              onPress={() => {
                if (channel.email && !canDisableProfile) return;
                onChangeChannel({ ...channel, email: !channel.email });
              }}
            />
            {profileVisible ? (
              <Row
                control={
                  <Checkbox
                    checked={channel.profile}
                    disabled={!canDisableEmail && channel.profile}
                    onCheckedChange={(next) => onChangeChannel({ ...channel, profile: next })}
                    testID="channel-profile-checkbox"
                  />
                }
                label="Post to profile"
                onPress={() => {
                  if (channel.profile && !canDisableEmail) return;
                  onChangeChannel({ ...channel, profile: !channel.profile });
                }}
              />
            ) : null}
            {showNoSectionsBanner ? (
              <View className="-mx-4 mt-2">
                <Banner
                  variant="info"
                  message="You currently have no sections in your profile. To post to a section, set one up on web first."
                />
              </View>
            ) : null}
          </View>

          <View className="border-t border-border" />

          <View className="px-4 py-4">
            <SectionHeader>Engagement</SectionHeader>
            <Row
              control={
                <Checkbox
                  checked={allowComments}
                  onCheckedChange={onChangeAllowComments}
                  testID="allow-comments-checkbox"
                />
              }
              label="Allow comments"
              onPress={() => onChangeAllowComments(!allowComments)}
            />
          </View>
        </ScrollView>
      </SheetContent>
    </Sheet>
  );
};
