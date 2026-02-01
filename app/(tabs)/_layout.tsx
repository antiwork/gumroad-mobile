import logoG from "@/assets/images/logo-g.svg";
import { LineIcon, SolidIcon } from "@/components/icon";
import { MiniAudioPlayer } from "@/components/mini-audio-player";
import { StyledImage } from "@/components/styled";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { env } from "@/lib/env";
import { BottomTabBar } from "@react-navigation/bottom-tabs";
import { Tabs } from "expo-router";
import { createContext, useContext, useState } from "react";
import { Linking, TouchableOpacity, View } from "react-native";
import { useCSSVariable, useResolveClassNames } from "uniwind";

interface SearchContextValue {
  isSearchActive: boolean;
  setSearchActive: (active: boolean) => void;
}

const SearchContext = createContext<SearchContextValue>({
  isSearchActive: false,
  setSearchActive: () => {},
});

export const useDashboardSearch = () => useContext(SearchContext);

const LogoIcon = () => <StyledImage source={logoG} className="ml-3 size-6" />;

const SearchButton = () => {
  const { isSearchActive, setSearchActive } = useDashboardSearch();
  return (
    <TouchableOpacity onPress={() => setSearchActive(!isSearchActive)}>
      <LineIcon name="search" size={24} className={isSearchActive ? "text-accent" : "text-foreground"} />
    </TouchableOpacity>
  );
};

interface SettingsSheetContextValue {
  isSettingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
}

const SettingsSheetContext = createContext<SettingsSheetContextValue>({
  isSettingsOpen: false,
  setSettingsOpen: () => {},
});

const useSettingsSheet = () => useContext(SettingsSheetContext);

const SettingsButton = () => {
  const { setSettingsOpen } = useSettingsSheet();
  return (
    <TouchableOpacity onPress={() => setSettingsOpen(true)}>
      <SolidIcon name="cog" size={24} className="text-foreground" />
    </TouchableOpacity>
  );
};

const SettingsSheet = () => {
  const { isSettingsOpen, setSettingsOpen } = useSettingsSheet();
  const { logout } = useAuth();

  const handleLogout = () => {
    setSettingsOpen(false);
    logout();
  };

  const handleDeleteAccount = () => {
    Linking.openURL(`${env.EXPO_PUBLIC_GUMROAD_URL}/settings/advanced`);
  };

  return (
    <Sheet open={isSettingsOpen} onOpenChange={setSettingsOpen}>
      <SheetHeader onClose={() => setSettingsOpen(false)}>
        <SheetTitle>Settings</SheetTitle>
      </SheetHeader>
      <SheetContent>
        <View className="border-b border-border p-4">
          <Text className="mb-2 font-sans text-lg text-foreground">Account</Text>
          <Text className="mb-4 text-sm text-muted-foreground">This will log you out of your Gumroad account.</Text>
          <Button onPress={handleLogout}>
            <Text>Logout</Text>
            <LineIcon name="log-out" size={20} className="text-primary-foreground" />
          </Button>
        </View>
        <View className="border-b border-border p-4">
          <Text className="mb-2 font-sans text-lg text-foreground">Danger Zone</Text>
          <Text className="mb-4 text-sm text-muted-foreground">
            Deleting your account will delete all of your products and product files, as well as any credit card and
            payout information.
          </Text>
          <Button variant="destructive" onPress={handleDeleteAccount}>
            <Text>Go to account deletion page</Text>
            <LineIcon name="right-arrow-alt" size={20} className="text-destructive-foreground" />
          </Button>
        </View>
      </SheetContent>
    </Sheet>
  );
};

const DashboardHeaderRight = () => (
  <View className="mr-3 flex-row items-center gap-4">
    <SearchButton />
    <SettingsButton />
  </View>
);

const LibraryHeaderRight = () => (
  <View className="mr-3">
    <SettingsButton />
  </View>
);

export default function TabsLayout() {
  const { isCreator } = useAuth();
  const [isSearchActive, setSearchActive] = useState(false);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [background, accent, muted, border] = useCSSVariable([
    "--color-background",
    "--color-accent",
    "--color-muted",
    "--color-border",
  ]);
  const headerTitleStyle = useResolveClassNames("font-sans text-foreground");
  const tabBarLabelStyle = useResolveClassNames("font-sans font-normal text-xs");

  return (
    <SearchContext.Provider value={{ isSearchActive, setSearchActive }}>
      <SettingsSheetContext.Provider value={{ isSettingsOpen, setSettingsOpen }}>
        <Tabs
          tabBar={(props) => (
            <View>
              <MiniAudioPlayer />
              <BottomTabBar {...props} />
            </View>
          )}
          screenOptions={{
            headerStyle: { backgroundColor: background as string },
            headerShadowVisible: false,
            headerTintColor: accent as string,
            headerTitleStyle,
            tabBarStyle: {
              backgroundColor: background as string,
              borderTopColor: border as string,
            },
            tabBarActiveTintColor: accent as string,
            tabBarInactiveTintColor: muted as string,
            tabBarLabelStyle,
          }}
        >
          <Tabs.Screen
            name="dashboard"
            options={{
              title: "Dashboard",
              headerLeft: () => <LogoIcon />,
              headerRight: () => <DashboardHeaderRight />,
              tabBarIcon: ({ color, size }) => <SolidIcon name="home" size={size} color={color} />,
              href: isCreator ? undefined : null,
            }}
          />
          <Tabs.Screen
            name="analytics"
            options={{
              title: "Analytics",
              headerLeft: () => <LogoIcon />,
              headerRight: () => <LibraryHeaderRight />,
              tabBarIcon: ({ color, size }) => <SolidIcon name="bar-chart-alt-2" size={size} color={color} />,
              href: isCreator ? undefined : null,
            }}
          />
          <Tabs.Screen
            name="library"
            options={{
              title: "Library",
              headerLeft: () => <LogoIcon />,
              headerRight: () => <LibraryHeaderRight />,
              tabBarIcon: ({ color, size }) => <SolidIcon name="bookmark-heart" size={size} color={color} />,
            }}
          />
        </Tabs>
        <SettingsSheet />
      </SettingsSheetContext.Provider>
    </SearchContext.Provider>
  );
}
