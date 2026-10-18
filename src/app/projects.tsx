
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Href, useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import { apiRequest } from "../lib/api";

type Project = {
  id: number;
  name: string;
  description: string | null;
};

export default function ProjectsScreen() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const router = useRouter();


  const loadProjects = useCallback(async () => {
    try {
      const token =
        await SecureStore.getItemAsync("access_token");

      if (!token) {
        Alert.alert("Sign in required", "Please log in first.");
        return;
      }

      setProjects(await apiRequest<Project[]>("/projects", {}, token));
    } catch (error) {
      Alert.alert(
        "Error",
        error instanceof Error ? error.message : "Request failed."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProjects();
    }, [loadProjects])
  );

  async function createProject() {
    if (!name.trim()) {
      Alert.alert("Project name required", "Enter a project name.");
      return;
    }

    setSaving(true);

    try {
      const token =
        await SecureStore.getItemAsync("access_token");

      if (!token) {
        throw new Error("Please sign in first.");
      }

      const project = await apiRequest<Project>("/projects", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
        }),
      }, token);

      setProjects((current) => [project, ...current]);
      setName("");
      setDescription("");
      Alert.alert("Success", "Project created successfully.");
    } catch (error) {
      Alert.alert(
        "Could not create project",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>My Projects</Text>
        <Text style={styles.subtitle}>
          Manage your fieldwork in one place.
        </Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Project name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Lagos Field Survey"
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder="What is this project about?"
          value={description}
          onChangeText={setDescription}
          multiline
        />

        <Pressable
          style={[styles.button, saving && styles.disabled]}
          onPress={createProject}
          disabled={saving}
        >
          <Text style={styles.buttonText}>
            {saving ? "Creating..." : "Create Project"}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Your projects</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#2457d6" />
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>
              No projects yet. Create your first project above.
            </Text>
          }
          renderItem={({ item }) => (
            <View style={styles.projectCard}>
              <Text style={styles.projectName}>{item.name}</Text>
              <Text style={styles.description}>
                {item.description || "No description"}
              </Text>
              <Text style={styles.projectId}>
                Project #{item.id}
              </Text>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/tasks",
                    params: {
                      projectId: String(item.id),
                      projectName: item.name,
                    },
                  } as unknown as Href)
                }
                style={styles.viewTasksButton}
              >
                <Text style={styles.viewTasksButtonText}>View Tasks →</Text>
              </Pressable>
              <Pressable
                  onPress={() =>
                    router.push({
                      pathname: "/observations",
                      params: {
                        projectId: String(item.id),
                        projectName: item.name,
                      },
                    } as unknown as Href)
                  }
                  style={{
                    backgroundColor: "#0F766E",
                    padding: 12,
                    borderRadius: 8,
                    marginTop: 8,
                  }}
                >
                  <Text style={{ color: "#FFFFFF", fontWeight: "600" }}>
                    Field Observations →
                  </Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f3f6fb",
    padding: 20,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#172033",
  },
  subtitle: {
    color: "#64748b",
    marginTop: 6,
  },
  form: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  label: {
    fontWeight: "600",
    color: "#334155",
  },
  input: {
    borderWidth: 1,
    borderColor: "#d8e0ec",
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
  },
  multiline: {
    minHeight: 72,
    textAlignVertical: "top",
  },
  button: {
    backgroundColor: "#2457d6",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 4,
  },
  disabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 24,
    marginBottom: 12,
    color: "#172033",
  },
  list: {
    gap: 12,
    paddingBottom: 30,
  },
  projectCard: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  projectName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#172033",
  },
  description: {
    color: "#64748b",
    marginTop: 6,
  },
  projectId: {
    color: "#2457d6",
    marginTop: 10,
    fontSize: 12,
  },
  viewTasksButton: {
    backgroundColor: "#2563EB",
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  viewTasksButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  empty: {
    color: "#64748b",
    textAlign: "center",
    padding: 20,
  },
});
