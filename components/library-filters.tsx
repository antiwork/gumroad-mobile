import { LineIcon } from "@/components/icon";
import { CreatorCount, SortOption } from "@/components/use-library-filters";
import { useState } from "react";
import { FlatList, Platform, TextInput, TouchableOpacity, View } from "react-native";
import { Drawer } from "react-native-drawer-layout";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCSSVariable } from "uniwind";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Text } from "./ui/text";

export interface LibraryFiltersProps {
  searchText: string;
  setSearchText: (text: string) => void;
  selectedCreators: Set<string>;
  showArchivedOnly: boolean;
  sortBy: SortOption;
  setSortBy: (sort: SortOption) => void;
  hasArchivedProducts: boolean;
  hasActiveFilters: boolean;
  creatorCounts: CreatorCount[];
  handleCreatorToggle: (creatorName: string) => void;
  handleSelectAllCreators: () => void;
  handleClearFilters: () => void;
  handleToggleArchived: () => void;
  children: React.ReactNode;
}

export const LibraryFilters = ({
  searchText,
  setSearchText,
  selectedCreators,
  showArchivedOnly,
  sortBy,
  setSortBy,
  hasArchivedProducts,
  hasActiveFilters,
  creatorCounts,
  handleCreatorToggle,
  handleSelectAllCreators,
  handleClearFilters,
  handleToggleArchived,
  children,
}: LibraryFiltersProps) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const mutedColor = useCSSVariable("--color-muted") as string;
  const backgroundColor = useCSSVariable("--color-background") as string;
  const insets = useSafeAreaInsets();

  return (
    <Drawer
      open={drawerOpen}
      onOpen={() => setDrawerOpen(true)}
      onClose={() => setDrawerOpen(false)}
      drawerPosition="right"
      drawerType="front"
      drawerStyle={{ width: 240, backgroundColor }}
      renderDrawerContent={() => (
        <View className="flex-1 border-l border-border" style={{ paddingBottom: insets.bottom }}>
          <View className="flex-row items-center justify-between border-b border-border p-4">
            <Text className="font-sans text-xl text-foreground">Filters</Text>
            {hasActiveFilters && (
              <Button size="sm" variant="outline" onPress={handleClearFilters}>
                <Text>Clear</Text>
              </Button>
            )}
          </View>

          <View className="border-b border-border p-4">
            <RadioGroup value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
              <View className="flex flex-row items-center gap-3">
                <RadioGroupItem value="content_updated_at" id="content_updated_at" />
                <Label
                  htmlFor="content_updated_at"
                  onPress={Platform.select({ native: () => setSortBy("content_updated_at") })}
                >
                  Recently updated
                </Label>
              </View>
              <View className="flex flex-row items-center gap-3">
                <RadioGroupItem value="purchased_at" id="purchased_at" />
                <Label htmlFor="purchased_at" onPress={Platform.select({ native: () => setSortBy("purchased_at") })}>
                  Purchase date
                </Label>
              </View>
            </RadioGroup>
          </View>

          <View className="flex-1 border-b border-border px-4 py-3">
            <FlatList
              data={creatorCounts}
              keyExtractor={(item) => item.name}
              ListHeaderComponent={
                <View className="flex flex-row items-center gap-3 py-1">
                  <Checkbox
                    id="allCreators"
                    checked={selectedCreators.size === 0}
                    onCheckedChange={handleSelectAllCreators}
                  />
                  <Label onPress={Platform.select({ native: handleSelectAllCreators })} htmlFor="allCreators">
                    All creators
                  </Label>
                </View>
              }
              renderItem={({ item }) => (
                <View className="flex flex-row items-center gap-3 py-1">
                  <Checkbox
                    id={item.username}
                    checked={selectedCreators.has(item.username)}
                    onCheckedChange={() => handleCreatorToggle(item.username)}
                  />
                  <Label
                    onPress={Platform.select({ native: () => handleCreatorToggle(item.username) })}
                    htmlFor={item.username}
                  >
                    {item.name} ({item.count})
                  </Label>
                </View>
              )}
            />
          </View>

          {hasArchivedProducts ? (
            <View className="flex-row items-center gap-3 border-b border-border px-4 py-3">
              <Checkbox id="archived" checked={showArchivedOnly} onCheckedChange={handleToggleArchived} />
              <Label onPress={Platform.select({ native: handleToggleArchived })} htmlFor="archived">
                Show archived only
              </Label>
            </View>
          ) : null}

          <View className="px-4 pt-4">
            <Button onPress={() => setDrawerOpen(false)}>
              <Text>Done</Text>
            </Button>
          </View>
        </View>
      )}
    >
      <View className="flex-row items-center gap-2 px-4 py-4">
        <View className="flex-1 flex-row items-center rounded border border-border bg-background px-3 py-2">
          <LineIcon name="search" size={20} className="text-muted" />
          <TextInput
            className="ml-2 flex-1 font-sans text-base text-foreground"
            placeholder="Search products..."
            placeholderTextColor={mutedColor}
            value={searchText}
            onChangeText={setSearchText}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText("")} hitSlop={8}>
              <LineIcon name="x" size={20} className="text-muted" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          onPress={() => setDrawerOpen(true)}
          className="rounded border border-border bg-background p-2"
        >
          <LineIcon name="filter" size={24} className={hasActiveFilters ? "text-accent" : "text-foreground"} />
        </TouchableOpacity>
      </View>
      {children}
    </Drawer>
  );
};
