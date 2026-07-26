import { Drawer } from 'expo-router/drawer';
import { colors } from '@/theme';
import { AppDrawerContent } from '@/features/navigation/AppDrawerContent';

export default function DrawerLayout() {
  return (
    <Drawer
      drawerContent={(props) => <AppDrawerContent {...props} />}
      screenOptions={{
        headerShown: true,
        headerTintColor: colors.text,
        headerStyle: {
          backgroundColor: colors.surface,
          shadowColor: 'transparent', // removes border on iOS
          elevation: 0, // removes border on Android
        },
        headerTitleStyle: {
          fontFamily: 'PlusJakartaSans_700Bold',
        },
        drawerActiveTintColor: colors.primary,
        drawerInactiveTintColor: colors.text,
        drawerStyle: {
          backgroundColor: colors.surface,
          width: 280,
        },
      }}
    >
      <Drawer.Screen
        name="(tabs)"
        options={{
          headerShown: false,
          drawerLabel: 'Home',
          title: 'Home',
        }}
      />
      <Drawer.Screen
        name="community"
        options={{
          drawerLabel: 'Community Guidelines',
          title: 'Community Guidelines',
        }}
      />
      <Drawer.Screen
        name="faq"
        options={{
          drawerLabel: 'FAQ',
          title: 'FAQ',
        }}
      />
      <Drawer.Screen
        name="contact"
        options={{
          drawerLabel: 'Contact Us',
          title: 'Contact Us',
        }}
      />
      <Drawer.Screen
        name="terms"
        options={{
          drawerLabel: 'Terms & Conditions',
          title: 'Terms & Conditions',
        }}
      />
      <Drawer.Screen
        name="privacy"
        options={{
          drawerLabel: 'Privacy Policy',
          title: 'Privacy Policy',
        }}
      />
      <Drawer.Screen
        name="refund-policy"
        options={{
          drawerLabel: 'Refund Policy',
          title: 'Refund Policy',
        }}
      />
    </Drawer>
  );
}
