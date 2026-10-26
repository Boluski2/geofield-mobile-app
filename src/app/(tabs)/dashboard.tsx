import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { ApiError, apiRequest } from "../../lib/api";

type ProjectSummary = { id: number; name: string; description?: string | null; task_count: number; completed_tasks: number };
type DashboardData = { user: string; project_count: number; task_count: number; completed_tasks: number; pending_tasks: number; projects: ProjectSummary[] };
const colors = { ink: "#18352c", forest: "#205a46", leaf: "#dceee3", muted: "#718078", line: "#e5ebe6", paper: "#f5f7f3", white: "#ffffff", amber: "#b7791f" } as const;

function progressOf(project: ProjectSummary) {
  return project.task_count ? Math.round((project.completed_tasks / project.task_count) * 100) : 0;
}

export default function DashboardScreen() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  useFocusEffect(useCallback(() => {
    async function loadDashboard() {
      setLoading(true); setError("");
      try {
        const token = await SecureStore.getItemAsync("access_token");
        if (!token) { router.replace("/"); return; }
        setData(await apiRequest<DashboardData>("/dashboard", {}, token));
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) { await SecureStore.deleteItemAsync("access_token"); router.replace("/"); return; }
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally { setLoading(false); }
    }
    void loadDashboard();
  }, [retryCount]));

  async function logout() { await SecureStore.deleteItemAsync("access_token"); router.replace("/"); }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.brandRow}><View style={styles.mark}><Text style={styles.markText}>G</Text></View><View><Text style={styles.brand}>GeoField</Text><Text style={styles.kicker}>FIELDWORK, ORGANIZED</Text></View></View>
          <Pressable accessibilityRole="button" onPress={logout} style={styles.logout}><Text style={styles.logoutText}>Log out</Text></Pressable>
        </View>

        <View style={styles.welcome}>
          <Text style={styles.eyebrow}>YOUR FIELD WORKSPACE</Text>
          <Text style={styles.title}>{data ? `Good morning, ${data.user.split(" ")[0]}` : "Your fieldwork, at a glance"}</Text>
          <Text style={styles.subtitle}>{loading ? "Loading your workspace…" : "Keep projects moving and field records in one place."}</Text>
        </View>

        <View style={styles.actions}>
          <Pressable onPress={() => router.push("/projects")} style={styles.primaryAction}><View style={styles.actionIcon}><Text style={styles.actionGlyph}>＋</Text></View><View style={styles.actionCopy}><Text style={styles.primaryTitle}>Projects</Text><Text style={styles.primaryHint}>Manage your fieldwork</Text></View><Text style={styles.arrowLight}>›</Text></Pressable>
          <Pressable onPress={() => router.push("/projects")} style={styles.secondaryAction}><Text style={styles.secondaryGlyph}>⌖</Text><View style={styles.actionCopy}><Text style={styles.secondaryTitle}>Record an observation</Text><Text style={styles.secondaryHint}>Choose a project to capture a site</Text></View><Text style={styles.arrow}>›</Text></Pressable>
        </View>

        <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Workspace overview</Text><Text style={styles.sectionNote}>LIVE SUMMARY</Text></View>
        <View style={styles.statsGrid}>
          {[{ label: "Projects", value: data?.project_count, glyph: "▦" }, { label: "Total tasks", value: data?.task_count, glyph: "☷" }, { label: "Completed", value: data?.completed_tasks, glyph: "✓" }, { label: "To do", value: data?.pending_tasks, glyph: "◷" }].map((stat, i) => (
            <View key={stat.label} style={styles.statCard}><View style={[styles.statIcon, i === 3 && styles.statIconAmber]}><Text style={[styles.statGlyph, i === 3 && styles.statGlyphAmber]}>{stat.glyph}</Text></View><Text style={styles.statValue}>{loading ? "—" : (stat.value ?? 0)}</Text><Text style={styles.statLabel}>{stat.label}</Text></View>
          ))}
        </View>

        <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Recent projects</Text><Pressable onPress={() => router.push("/projects")}><Text style={styles.viewAll}>View all  ›</Text></Pressable></View>
        {error ? <View style={styles.stateCard}><Text style={styles.error}>{error}</Text><Pressable onPress={() => setRetryCount((n) => n + 1)} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable></View>
          : loading ? <View style={styles.stateCard}><ActivityIndicator color={colors.forest} /><Text style={styles.stateText}>Loading your projects…</Text></View>
          : !data?.projects.length ? <View style={styles.stateCard}><Text style={styles.emptyTitle}>No projects yet</Text><Text style={styles.stateText}>Create a project to start organizing field tasks and observations.</Text><Pressable onPress={() => router.push("/projects")} style={styles.retry}><Text style={styles.retryText}>Create a project</Text></Pressable></View>
          : data.projects.slice(0, 4).map((project) => {
            const progress = progressOf(project);
            return <Pressable key={project.id} onPress={() => router.push({ pathname: "/tasks", params: { projectId: String(project.id), projectName: project.name } })} style={styles.projectCard}>
              <View style={styles.projectTop}><View style={styles.projectMark}><Text style={styles.projectMarkText}>{project.name.trim().charAt(0).toUpperCase()}</Text></View><View style={styles.projectInfo}><Text style={styles.projectTitle} numberOfLines={1}>{project.name}</Text><Text style={styles.projectDescription} numberOfLines={1}>{project.description || "Field project"}</Text></View><Text style={styles.projectPercent}>{progress}%</Text></View>
              <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View>
              <View style={styles.projectFoot}><Text style={styles.projectMeta}>{project.completed_tasks} of {project.task_count} tasks complete</Text><Text style={styles.projectOpen}>Open tasks  ›</Text></View>
            </Pressable>;
          })}
        <Text style={styles.footer}>GeoField · Built for the field</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper }, content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 36, width: "100%", maxWidth: 700, alignSelf: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 30 }, brandRow: { flexDirection: "row", alignItems: "center", gap: 10 }, mark: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.forest, alignItems: "center", justifyContent: "center" }, markText: { color: colors.white, fontSize: 22, fontWeight: "800" }, brand: { color: colors.ink, fontSize: 18, fontWeight: "800", letterSpacing: -0.3 }, kicker: { color: colors.muted, fontSize: 8, fontWeight: "800", letterSpacing: 1.2, marginTop: 2 }, logout: { paddingVertical: 9, paddingHorizontal: 13, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, borderRadius: 10 }, logoutText: { color: colors.ink, fontSize: 12, fontWeight: "700" },
  welcome: { marginBottom: 22 }, eyebrow: { color: colors.forest, fontSize: 10, fontWeight: "800", letterSpacing: 1.3, marginBottom: 8 }, title: { color: colors.ink, fontSize: 27, lineHeight: 34, fontWeight: "800", letterSpacing: -0.7 }, subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 6 },
  actions: { gap: 10, marginBottom: 28 }, primaryAction: { minHeight: 76, borderRadius: 17, backgroundColor: colors.forest, padding: 15, flexDirection: "row", alignItems: "center", gap: 12 }, actionIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: "#ffffff24", alignItems: "center", justifyContent: "center" }, actionGlyph: { color: colors.white, fontSize: 24, lineHeight: 27 }, actionCopy: { flex: 1 }, primaryTitle: { color: colors.white, fontWeight: "800", fontSize: 15 }, primaryHint: { color: "#d4e7da", fontSize: 11, marginTop: 3 }, arrowLight: { color: colors.white, fontSize: 25 }, secondaryAction: { minHeight: 70, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }, secondaryGlyph: { width: 40, height: 40, textAlign: "center", textAlignVertical: "center", borderRadius: 13, overflow: "hidden", backgroundColor: colors.leaf, color: colors.forest, fontSize: 25 }, secondaryTitle: { color: colors.ink, fontWeight: "700", fontSize: 13 }, secondaryHint: { color: colors.muted, fontSize: 11, marginTop: 3 }, arrow: { color: colors.muted, fontSize: 24 },
  sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }, sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: "800", letterSpacing: -0.2 }, sectionNote: { color: colors.muted, fontSize: 9, letterSpacing: 1, fontWeight: "800" }, statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 27 }, statCard: { width: "48%", flexGrow: 1, minHeight: 113, backgroundColor: colors.white, borderRadius: 15, borderWidth: 1, borderColor: colors.line, padding: 13 }, statIcon: { width: 28, height: 28, borderRadius: 9, backgroundColor: colors.leaf, alignItems: "center", justifyContent: "center" }, statGlyph: { color: colors.forest, fontSize: 15, fontWeight: "800" }, statIconAmber: { backgroundColor: "#fbf0dc" }, statGlyphAmber: { color: colors.amber }, statValue: { color: colors.ink, fontSize: 25, fontWeight: "800", marginTop: 9 }, statLabel: { color: colors.muted, fontSize: 11, fontWeight: "600", marginTop: 1 }, viewAll: { color: colors.forest, fontSize: 12, fontWeight: "700" },
  projectCard: { padding: 14, borderRadius: 15, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, marginBottom: 10 }, projectTop: { flexDirection: "row", alignItems: "center", gap: 11 }, projectMark: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.leaf, alignItems: "center", justifyContent: "center" }, projectMarkText: { color: colors.forest, fontSize: 15, fontWeight: "800" }, projectInfo: { flex: 1 }, projectTitle: { color: colors.ink, fontSize: 14, fontWeight: "700" }, projectDescription: { color: colors.muted, fontSize: 11, marginTop: 3 }, projectPercent: { color: colors.forest, fontSize: 13, fontWeight: "800" }, progressTrack: { height: 5, borderRadius: 4, overflow: "hidden", backgroundColor: "#edf1ed", marginTop: 14 }, progressFill: { height: "100%", backgroundColor: "#57916e", borderRadius: 4 }, projectFoot: { flexDirection: "row", justifyContent: "space-between", marginTop: 9 }, projectMeta: { color: colors.muted, fontSize: 10 }, projectOpen: { color: colors.forest, fontSize: 10, fontWeight: "700" },
  stateCard: { minHeight: 110, padding: 18, borderRadius: 15, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center", gap: 8 }, emptyTitle: { color: colors.ink, fontSize: 15, fontWeight: "800" }, stateText: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: "center" }, error: { color: "#a33b30", fontSize: 12, textAlign: "center" }, retry: { backgroundColor: colors.leaf, paddingVertical: 9, paddingHorizontal: 13, borderRadius: 9, marginTop: 2 }, retryText: { color: colors.forest, fontSize: 12, fontWeight: "800" }, footer: { color: "#9aa49d", fontSize: 10, textAlign: "center", marginTop: 24 },
});
