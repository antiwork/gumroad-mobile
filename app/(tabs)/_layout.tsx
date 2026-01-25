import logoG from "@/assets/images/logo-g.svg";
import { SolidIcon } from "@/components/icon";
import { StyledImage } from "@/components/styled";
import { Tabs } from "expo-router";
import { TouchableOpacity } from "react-native";
import { useCSSVariable } from "uniwind";
import { useAuth } from "../../lib/auth-context";

const LogoIcon = () => <StyledImage source={logoG} className="ml-3 size-6" />;

const SignOutButton = () => {
  const { logout } = useAuth();
  // TODO: sheet with delete account prompt as well as logout
  return (
    <TouchableOpacity onPress={logout} className="mr-3">
      <SolidIcon name="cog" size={24} className="text-foreground" />
    </TouchableOpacity>
  );
};

export default function TabsLayout() {
  const [background, foreground, accent, muted, border] = useCSSVariable([
    "--color-background",
    "--color-foreground",
    "--color-accent",
    "--color-muted",
    "--color-border",
  ]);

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: background as string },
        headerShadowVisible: false,
        headerTintColor: accent as string,
        headerTitleStyle: { fontFamily: "ABC Favorit", color: foreground as string },
        tabBarStyle: {
          backgroundColor: background as string,
          borderTopColor: border as string,
        },
        tabBarActiveTintColor: foreground as string,
        tabBarInactiveTintColor: muted as string,
        tabBarLabelStyle: { fontFamily: "ABC Favorit" },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          headerLeft: () => <LogoIcon />,
          headerRight: () => <SignOutButton />,
          tabBarIcon: ({ color, size }) => <SolidIcon name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: "Library",
          headerLeft: () => <LogoIcon />,
          headerRight: () => <SignOutButton />,
          tabBarIcon: ({ color, size }) => <SolidIcon name="box" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
