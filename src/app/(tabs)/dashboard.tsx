
import { useCallback, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { apiRequest, ApiError } from "../../lib/api";

type ProjectSummary = {
  id: number;
  name: string;
  description?: string | null;
  task_count: number;
  completed_tasks: number;
};

function getProjectProgress(project: ProjectSummary) {
  if (project.task_count === 0) {
    return 0;
  }

  return Math.round(
    (project.completed_tasks / project.task_count) * 100
  );
}

type DashboardData = {
  user: string;
  project_count: number;
  task_count: number;
  completed_tasks: number;
  pending_tasks: number;
  projects: ProjectSummary[];
};

export default function DashboardScreen() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      async function loadDashboard() {
        setLoading(true);
        setError("");
        try {
          const token =
            await SecureStore.getItemAsync("access_token");

          if (!token) {
            router.replace("/");
            return;
          }

          const result = await apiRequest<DashboardData>("/dashboard", {}, token);
          setData(result);
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) {
            await SecureStore.deleteItemAsync("access_token");
            router.replace("/");
            return;
          }
          setError(
            err instanceof Error
              ? err.message
              : "Something went wrong."
          );
        } finally {
          setLoading(false);
        }
      }

      loadDashboard();
    }, [retryCount])
  );

  async function logout() {
    await SecureStore.deleteItemAsync("access_token");
    router.replace("/");
  }

  const stats = [
    { label: "Projects", value: data?.project_count },
    { label: "All tasks", value: data?.task_count },
    { label: "Completed", value: data?.completed_tasks },
    { label: "Pending", value: data?.pending_tasks },
  ];

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>GeoField</Text>
            <Text style={styles.muted}>Your workspace</Text>
          </View>

          <Pressable onPress={logout}>
            <Text style={styles.logout}>Log out</Text>
          </Pressable>
        </View>

        <Text style={styles.greeting}>
          {data ? `Welcome, ${data.user}` : "Welcome to GeoField"}
        </Text>
        <Text style={styles.subtitle}>
          {loading
            ? "Loading your workspace..."
            : "Here's what's happening with your projects."}
        </Text>

        <Pressable
          onPress={() => router.push("/projects")}
          style={{
            backgroundColor: "#2457d6",
            padding: 14,
            borderRadius: 10,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "700" }}>
            Manage Projects
          </Text>
        </Pressable>

        <View style={styles.grid}>
          {stats.map((stat) => (
            <View key={stat.label} style={styles.statCard}>
              <Text style={styles.statValue}>
                {stat.value ?? "—"}
              </Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>My Projects</Text>

        {error ? (
          <View style={styles.projectCard}>
            <Text style={styles.error}>{error}</Text>
            <Pressable
              style={styles.button}
              onPress={() => setRetryCount((count) => count + 1)}
            >
              <Text style={styles.buttonText}>Try again</Text>
            </Pressable>
          </View>
        ) : loading ? (
          <View style={styles.projectCard}>
            <Text style={styles.muted}>Loading your projects...</Text>
          </View>
        ) : data?.projects.length === 0 ? (
          <View style={styles.projectCard}>
            <Text style={styles.projectTitle}>
              No projects yet
            </Text>
            <Text style={styles.muted}>
              Create a project in your backend to see it here.
            </Text>
          </View>
        ) : (
          (data?.projects ?? []).map((project) => {
            const progress = getProjectProgress(project);

            return (
              <View key={project.id} style={styles.projectCard}>
                <Text style={styles.projectTitle}>
                  {project.name}
                </Text>

                <Text style={styles.muted}>
                  {project.description || "No description provided"}
                </Text>

                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${progress}%` },
                    ]}
                  />
                </View>

                <Text style={styles.muted}>{progress}% complete</Text>

                {/* <Text style={styles.muted}>
                  {project.completed_tasks} of {project.task_count}{" "}
                  tasks completed · {progress}%
                </Text> */}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f3f6fb",
  },
  content: {
    padding: 24,
    paddingBottom: 40,
    gap: 16,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brand: {
    color: "#2457d6",
    fontSize: 26,
    fontWeight: "800",
  },
  greeting: {
    fontSize: 25,
    fontWeight: "700",
    color: "#172033",
    marginTop: 12,
  },
  subtitle: {
    color: "#64748b",
  },
  muted: {
    color: "#64748b",
    fontSize: 13,
    marginTop: 5,
  },
  logout: {
    color: "#2457d6",
    fontWeight: "700",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statCard: {
    width: "47%",
    flexGrow: 1,
    backgroundColor: "#fff",
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  statValue: {
    fontSize: 28,
    fontWeight: "800",
    color: "#2457d6",
  },
  statLabel: {
    color: "#64748b",
    marginTop: 5,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#172033",
    marginTop: 10,
  },
  projectCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 18,
    gap: 8,
  },
  projectTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#172033",
  },
  progressTrack: {
    height: 8,
    backgroundColor: "#e2e8f0",
    borderRadius: 10,
    overflow: "hidden",
    marginTop: 8,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#2457d6",
    borderRadius: 10,
  },
  button: {
    backgroundColor: "#2457d6",
    padding: 14,
    borderRadius: 10,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },
  error: {
    color: "#b91c1c",
    textAlign: "center",
  },
});
