import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

const green = "#205a46";

export default function ExploreScreen() {
  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.brandRow}><View style={styles.mark}><Text style={styles.markText}>G</Text></View><View><Text style={styles.brand}>GeoField</Text><Text style={styles.kicker}>FIELDWORK, ORGANIZED</Text></View></View>
        <Text style={styles.eyebrow}>FIELD TOOLS</Text>
        <Text style={styles.title}>Everything you need in the field.</Text>
        <Text style={styles.subtitle}>Choose a workspace to continue your fieldwork.</Text>
        <Pressable onPress={() => router.push("/projects")} style={styles.featured}>
          <View style={styles.featuredIcon}><Text style={styles.featuredGlyph}>▦</Text></View>
          <Text style={styles.featuredTitle}>Projects</Text>
          <Text style={styles.featuredText}>Organize surveys, tasks, and observation records by project.</Text>
          <Text style={styles.featuredLink}>Open projects  ›</Text>
        </Pressable>
        <Text style={styles.sectionTitle}>Field tools</Text>
        <Pressable onPress={() => router.push("/projects")} style={styles.toolCard}>
          <View style={styles.toolIcon}><Text style={styles.toolGlyph}>⌖</Text></View><View style={styles.toolCopy}><Text style={styles.toolTitle}>Observations</Text><Text style={styles.toolText}>Capture a location, notes, and site details.</Text></View><Text style={styles.chevron}>›</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/projects")} style={styles.toolCard}>
          <View style={styles.toolIcon}><Text style={styles.toolGlyph}>☷</Text></View><View style={styles.toolCopy}><Text style={styles.toolTitle}>Tasks</Text><Text style={styles.toolText}>Review project work and track completion.</Text></View><Text style={styles.chevron}>›</Text>
        </Pressable>
        <View style={styles.tip}><Text style={styles.tipIcon}>i</Text><Text style={styles.tipText}>Select a project first to view its tasks, record observations, or open its map.</Text></View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f5f7f3" }, content: { width: "100%", maxWidth: 700, alignSelf: "center", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 35 }, mark: { width: 40, height: 40, borderRadius: 13, backgroundColor: green, alignItems: "center", justifyContent: "center" }, markText: { color: "#fff", fontSize: 22, fontWeight: "800" }, brand: { color: "#18352c", fontSize: 18, fontWeight: "800" }, kicker: { color: "#718078", fontSize: 8, fontWeight: "800", letterSpacing: 1.2, marginTop: 2 },
  eyebrow: { color: green, fontSize: 10, fontWeight: "800", letterSpacing: 1.3, marginBottom: 8 }, title: { color: "#18352c", fontSize: 27, lineHeight: 34, fontWeight: "800", letterSpacing: -0.6 }, subtitle: { color: "#718078", fontSize: 14, lineHeight: 21, marginTop: 7, marginBottom: 22 },
  featured: { backgroundColor: green, borderRadius: 18, padding: 18, marginBottom: 29 }, featuredIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: "#ffffff24", alignItems: "center", justifyContent: "center", marginBottom: 15 }, featuredGlyph: { color: "#fff", fontSize: 21 }, featuredTitle: { color: "#fff", fontSize: 18, fontWeight: "800" }, featuredText: { color: "#d4e7da", fontSize: 13, lineHeight: 19, marginTop: 5 }, featuredLink: { color: "#fff", fontSize: 12, fontWeight: "800", marginTop: 16 }, sectionTitle: { color: "#18352c", fontSize: 17, fontWeight: "800", marginBottom: 11 },
  toolCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 15, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5ebe6", marginBottom: 10 }, toolIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: "#dceee3", alignItems: "center", justifyContent: "center" }, toolGlyph: { color: green, fontSize: 21 }, toolCopy: { flex: 1 }, toolTitle: { color: "#18352c", fontSize: 14, fontWeight: "800" }, toolText: { color: "#718078", fontSize: 11, marginTop: 3 }, chevron: { color: "#718078", fontSize: 24 }, tip: { flexDirection: "row", gap: 10, padding: 13, borderRadius: 13, backgroundColor: "#edf3ee", marginTop: 9 }, tipIcon: { width: 20, height: 20, overflow: "hidden", borderRadius: 10, textAlign: "center", color: green, backgroundColor: "#dceee3", fontWeight: "800" }, tipText: { flex: 1, color: "#596c61", fontSize: 11, lineHeight: 17 },
});
