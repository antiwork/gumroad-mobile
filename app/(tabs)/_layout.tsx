import logoG from "@/assets/images/logo-g.svg";
import { LineIcon, SolidIcon } from "@/components/icon";
import { StyledImage } from "@/components/styled";
import { Tabs } from "expo-router";
import { createContext, useContext, useState } from "react";
import { TouchableOpacity, View } from "react-native";
import { useCSSVariable, useResolveClassNames } from "uniwind";
import { useAuth } from "../../lib/auth-context";

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

const SignOutButton = () => {
  const { logout } = useAuth();
  // TODO: sheet with delete account prompt as well as logout
  return (
    <TouchableOpacity onPress={logout}>
      <SolidIcon name="cog" size={24} className="text-foreground" />
    </TouchableOpacity>
  );
};

const DashboardHeaderRight = () => (
  <View className="mr-3 flex-row items-center gap-4">
    <SearchButton />
    <SignOutButton />
  </View>
);

const LibraryHeaderRight = () => (
  <View className="mr-3">
    <SignOutButton />
  </View>
);

export default function TabsLayout() {
  const [isSearchActive, setSearchActive] = useState(false);
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
      <Tabs
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
    </SearchContext.Provider>
  );
}
