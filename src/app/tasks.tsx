
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { apiRequest } from "../lib/api";

type Task = {
  id: number;
  title: string;
  completed: boolean;
  project_id: number;
};

type TasksResponse = {
  tasks: Task[];
};

type Filter = "all" | "completed" | "pending";

async function getToken() {
  if (Platform.OS === "web") {
    return localStorage.getItem("access_token");
  }

  return SecureStore.getItemAsync("access_token");
}

export default function TasksScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    projectId: string;
    projectName?: string;
  }>();

  const projectId = Number(params.projectId);
  const projectName = params.projectName || "Project Tasks";

  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const request = useCallback(
    async (path: string, options: RequestInit = {}) => {
      const token = await getToken();

      if (!token) {
        throw new Error("Your session has expired. Please log in again.");
      }

      return apiRequest(path, options, token);
    },
    []
  );

  const loadTasks = useCallback(async () => {
    if (!Number.isInteger(projectId) || projectId < 1) {
      setError("Invalid project. Return to Projects and select a project.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
        const data = (await request(
          `/projects/${projectId}/tasks?status=${filter}`
        )) as TasksResponse;

        setTasks(data.tasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load tasks.");
    } finally {
      setLoading(false);
    }
  }, [projectId, filter, request]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  async function addTask() {
    const title = newTitle.trim();

    if (!title) {
      Alert.alert("Task required", "Enter a task title first.");
      return;
    }

    setSaving(true);

    try {
      await request(`/projects/${projectId}/tasks`, {
        method: "POST",
        body: JSON.stringify({ title }),
      });

      setNewTitle("");
      await loadTasks();
    } catch (err) {
      Alert.alert(
        "Could not create task",
        err instanceof Error ? err.message : "Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleTask(task: Task) {
    try {
      await request(
        `/projects/${projectId}/tasks/${task.id}?completed=${!task.completed}`,
        { method: "PATCH" }
      );

      await loadTasks();
    } catch (err) {
      Alert.alert(
        "Could not update task",
        err instanceof Error ? err.message : "Please try again."
      );
    }
  }

  async function removeTask(task: Task) {
    const performDelete = async () => {
      try {
        await request(
          `/projects/${projectId}/tasks/${task.id}`,
          { method: "DELETE" }
        );
        await loadTasks();
      } catch (err) {
        Alert.alert(
          "Could not delete task",
          err instanceof Error ? err.message : "Please try again."
        );
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm(`Delete "${task.title}"?`)) {
        await performDelete();
      }
    } else {
      Alert.alert("Delete task", `Delete "${task.title}"?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => void performDelete(),
        },
      ]);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>← Back to projects</Text>
      </Pressable>

      <Text style={styles.heading}>{projectName}</Text>
      <Text style={styles.subtitle}>Manage your project tasks</Text>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Enter a new task..."
          value={newTitle}
          onChangeText={setNewTitle}
          maxLength={200}
          onSubmitEditing={() => void addTask()}
        />

        <Pressable
          style={[styles.addButton, saving && styles.disabled]}
          disabled={saving}
          onPress={() => void addTask()}
        >
          <Text style={styles.addButtonText}>
            {saving ? "Adding..." : "+ Add"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.filters}>
        {(["all", "pending", "completed"] as Filter[]).map((item) => (
          <Pressable
            key={item}
            onPress={() => setFilter(item)}
            style={[
              styles.filterButton,
              filter === item && styles.activeFilter,
            ]}
          >
            <Text
              style={[
                styles.filterText,
                filter === item && styles.activeFilterText,
              ]}
            >
              {item[0].toUpperCase() + item.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" style={styles.loader} />
      ) : error ? (
        <View style={styles.empty}>
          <Text style={styles.error}>{error}</Text>
          <Pressable style={styles.retry} onPress={() => void loadTasks()}>
            <Text style={styles.addButtonText}>Try again</Text>
          </Pressable>
          <Pressable onPress={() => router.replace("/")}>
            <Text style={styles.back}>Return to login</Text>
          </Pressable>
        </View>
      ) : tasks.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No tasks found</Text>
          <Text style={styles.subtitle}>
            Add a task or choose another filter.
          </Text>
        </View>
      ) : (
        tasks.map((task) => (
          <View key={task.id} style={styles.taskCard}>
            <Pressable
              style={styles.taskInfo}
              onPress={() => void toggleTask(task)}
            >
              <Text style={styles.taskStatus}>
                {task.completed ? "☑" : "☐"}
              </Text>
              <Text
                style={[
                  styles.taskTitle,
                  task.completed && styles.completedTitle,
                ]}
              >
                {task.title}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => void removeTask(task)}
              accessibilityLabel={`Delete ${task.title}`}
              hitSlop={8}
            >
              <Text style={styles.delete}>Delete</Text>
            </Pressable>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingTop: 32,
    paddingBottom: 48,
    maxWidth: 760,
    width: "100%",
    alignSelf: "center",
    flexGrow: 1,
    backgroundColor: "#F8FAFC",
  },
  back: { color: "#2563EB", fontWeight: "600", marginBottom: 20 },
  heading: { fontSize: 28, fontWeight: "800", color: "#0F172A" },
  subtitle: { color: "#64748B", marginTop: 6, marginBottom: 20 },
  form: { flexDirection: "row", gap: 8, marginBottom: 20 },
  input: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    padding: 13,
    backgroundColor: "#FFFFFF",
  },
  addButton: {
    backgroundColor: "#2563EB",
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  addButtonText: { color: "#FFFFFF", fontWeight: "700" },
  disabled: { opacity: 0.6 },
  filters: { flexDirection: "row", gap: 8, marginBottom: 16 },
  filterButton: {
    borderRadius: 20,
    paddingVertical: 9,
    paddingHorizontal: 14,
    backgroundColor: "#E2E8F0",
  },
  activeFilter: { backgroundColor: "#1D4ED8" },
  filterText: { color: "#334155", fontWeight: "600" },
  activeFilterText: { color: "#FFFFFF" },
  loader: { marginTop: 40 },
  empty: { alignItems: "center", paddingVertical: 36, gap: 12 },
  emptyTitle: { color: "#0F172A", fontSize: 18, fontWeight: "700" },
  error: { color: "#B91C1C", textAlign: "center" },
  retry: {
    backgroundColor: "#2563EB",
    padding: 12,
    borderRadius: 8,
  },
  taskCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  taskInfo: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  taskStatus: { fontSize: 22, color: "#2563EB" },
  taskTitle: { flex: 1, fontSize: 15, color: "#0F172A" },
  completedTitle: { color: "#94A3B8", textDecorationLine: "line-through" },
  delete: { color: "#DC2626", fontWeight: "600" },
});
