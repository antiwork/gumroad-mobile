import { LineIcon, SolidIcon } from "@/components/icon";
import { CreatorCount, SortOption } from "@/lib/use-library-filters";
import { useState } from "react";
import { FlatList, Modal, Pressable, Text, TextInput, View } from "react-native";
import { useCSSVariable } from "uniwind";

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
}: LibraryFiltersProps) => {
  const [showFilterModal, setShowFilterModal] = useState(false);
  const mutedColor = useCSSVariable("--color-muted") as string;

  return (
    <>
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
            <Pressable onPress={() => setSearchText("")} hitSlop={8}>
              <LineIcon name="x" size={20} className="text-muted" />
            </Pressable>
          )}
        </View>
        <Pressable onPress={() => setShowFilterModal(true)} className="rounded border border-border bg-background p-2">
          {hasActiveFilters ? (
            <SolidIcon name="filter-alt" size={24} className="text-accent" />
          ) : (
            <LineIcon name="filter" size={24} className="text-foreground" />
          )}
        </Pressable>
      </View>

      <Modal
        visible={showFilterModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View className="flex-1 bg-background">
          <View className="flex-row items-center justify-between border-b border-border px-4 py-4">
            <Text className="font-sans text-xl font-bold text-foreground">Filters</Text>
            <Pressable onPress={() => setShowFilterModal(false)} className="p-2">
              <LineIcon name="x" size={24} className="text-foreground" />
            </Pressable>
          </View>

          <FlatList
            data={creatorCounts}
            keyExtractor={(item) => item.name}
            ListHeaderComponent={
              <>
                <View className="border-b border-border px-4 py-3">
                  <Text className="font-sans text-sm font-semibold tracking-wide text-muted uppercase">Sort by</Text>
                </View>

                <Pressable
                  onPress={() => setSortBy("content_updated_at")}
                  className="flex-row items-center justify-between border-b border-border px-4 py-4"
                >
                  <Text className="font-sans text-base text-foreground">Recently Updated</Text>
                  {sortBy === "content_updated_at" && <LineIcon name="check" size={24} className="text-accent" />}
                </Pressable>

                <Pressable
                  onPress={() => setSortBy("purchased_at")}
                  className="flex-row items-center justify-between border-b border-border px-4 py-4"
                >
                  <Text className="font-sans text-base text-foreground">Purchase Date</Text>
                  {sortBy === "purchased_at" && <LineIcon name="check" size={24} className="text-accent" />}
                </Pressable>

                <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
                  <Text className="font-sans text-sm font-semibold tracking-wide text-muted uppercase">Creators</Text>
                  {hasActiveFilters && (
                    <Pressable onPress={handleClearFilters}>
                      <Text className="font-sans text-sm text-accent">Clear</Text>
                    </Pressable>
                  )}
                </View>

                <Pressable
                  onPress={handleSelectAllCreators}
                  className="flex-row items-center justify-between border-b border-border px-4 py-4"
                >
                  <Text className="font-sans text-base text-foreground">All Creators</Text>
                  {selectedCreators.size === 0 && <LineIcon name="check" size={24} className="text-accent" />}
                </Pressable>
              </>
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => handleCreatorToggle(item.name)}
                className="flex-row items-center justify-between border-b border-border px-4 py-4"
              >
                <View className="flex-1 flex-row items-center gap-2">
                  <Text className="flex-1 font-sans text-base text-foreground" numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text className="font-sans text-sm text-muted">{item.count}</Text>
                </View>
                {selectedCreators.has(item.name) && <LineIcon name="check" size={24} className="ml-2 text-accent" />}
              </Pressable>
            )}
            ListFooterComponent={
              hasArchivedProducts ? (
                <>
                  <View className="border-b border-border px-4 py-3">
                    <Text className="font-sans text-sm font-semibold tracking-wide text-muted uppercase">Archived</Text>
                  </View>
                  <Pressable
                    onPress={handleToggleArchived}
                    className="flex-row items-center justify-between border-b border-border px-4 py-4"
                  >
                    <Text className="font-sans text-base text-foreground">Show archived only</Text>
                    {showArchivedOnly && <LineIcon name="check" size={24} className="text-accent" />}
                  </Pressable>
                </>
              ) : null
            }
          />
        </View>
      </Modal>
    </>
  );
};
