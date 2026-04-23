import React, { useMemo } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Platform,
  useWindowDimensions,
  StatusBar as RNStatusBar,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

import { useWebFont } from "./src/useWebFont";
import { DirContext, buildDirState, type Locale } from "./src/useDir";
import { Background, SectionHeader, Dots, FakeStatusBar } from "./src/components/atoms";
import { Header } from "./src/components/Header";
import { QuickActions } from "./src/components/QuickActions";
import { ClinicsRow } from "./src/components/ClinicsRow";
import { SupportRow } from "./src/components/SupportRow";
import { TherapistsRow } from "./src/components/TherapistsRow";
import { TabBar } from "./src/components/TabBar";

const PHONE_MAX = 430;

export default function App() {
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
    ...MaterialCommunityIcons.font,
  });

  const locale: Locale = "ar";
  const dir = useMemo(() => buildDirState(locale), [locale]);

  useWebFont(dir.locale, dir.isRTL);

  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width > PHONE_MAX + 40;

  if (!fontsLoaded) return null;

  return (
    <DirContext.Provider value={dir}>
      <SafeAreaProvider>
        <View style={[outer.root, isDesktop && outer.desktopRoot]}>
          <View style={[outer.phone, isDesktop && outer.phoneDesktop]}>
            <Background />
            <RNStatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
              {isDesktop ? <FakeStatusBar /> : null}
              <ScrollView
                contentContainerStyle={{ paddingBottom: 120 }}
                showsVerticalScrollIndicator={false}
              >
                <Header />
                <QuickActions />

                <SectionHeader title={locale === "ar" ? "عياداتنا" : "Our clinics"} />
                <ClinicsRow />
                <Dots n={3} active={0} />

                <SectionHeader title={locale === "ar" ? "جلسات الدعم" : "Support sessions"} />
                <SupportRow />
                <Dots n={3} active={0} />

                <SectionHeader title={locale === "ar" ? "المعالجين" : "Therapists"} />
                <TherapistsRow />
                <Dots n={3} active={0} />
              </ScrollView>
              <TabBar />
            </SafeAreaView>
          </View>
        </View>
      </SafeAreaProvider>
    </DirContext.Provider>
  );
}

const outer = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#E4ECED" },
  desktopRoot: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },
  phone: { flex: 1, overflow: "hidden" },
  phoneDesktop: {
    width: PHONE_MAX,
    height: 900,
    maxHeight: "96%",
    borderRadius: 46,
    flex: 0,
    borderWidth: 8,
    borderColor: "#1b2226",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 18 },
  },
});
