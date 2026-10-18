
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
import { Href, useLocalSearchParams, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import * as Location from "expo-location";

type Observation = {
  id: number;
  project_id: number;
  title: string;
  notes?: string | null;
  latitude: number;
  longitude: number;
  created_at: string;
};

const API_URL = (
  process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

async function getAccessToken() {
  if (Platform.OS === "web") {
    return localStorage.getItem("access_token");
  }

  return SecureStore.getItemAsync("access_token");
}

export default function ObservationsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    projectId: string;
    projectName?: string;
  }>();

  const projectId = Number(params.projectId);
  const projectName = params.projectName || "Field Observations";

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const request = useCallback(
    async (path: string, options: RequestInit = {}) => {
      const token = await getAccessToken();

      if (!token) {
        throw new Error("No login session found. Please log in again.");
      }

      const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(options.body
            ? { "Content-Type": "application/json" }
            : {}),
          ...options.headers,
        },
      });

      if (response.status === 401) {
        throw new Error("Your session has expired. Please log in again.");
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.detail || `Request failed: ${response.status}`);
      }

      return data;
    },
    []
  );

  const loadObservations = useCallback(async () => {
    if (!Number.isInteger(projectId) || projectId < 1) {
      setError("Invalid project. Return to Projects and select a project.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await request(
        `/projects/${projectId}/observations`
      );
      const items = Array.isArray(data) ? data : data?.observations;

      if (!Array.isArray(items)) {
        throw new Error("The API did not return an observations list.");
      }

      setObservations(items);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load observations."
      );
    } finally {
      setLoading(false);
    }
  }, [projectId, request]);

  useEffect(() => {
    void loadObservations();
  }, [loadObservations]);

  async function captureLocation() {
    setLocating(true);
    setError("");

    try {
      const permission =
        await Location.requestForegroundPermissionsAsync();

      if (permission.status !== "granted") {
        throw new Error(
          "Location permission was denied. Enable location access in your device settings."
        );
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      setLatitude(position.coords.latitude);
      setLongitude(position.coords.longitude);
      setAccuracy(position.coords.accuracy);

      Alert.alert(
        "Location captured",
        `Latitude: ${position.coords.latitude.toFixed(6)}\nLongitude: ${position.coords.longitude.toFixed(6)}`
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not capture location.";

      if (Platform.OS === "web") {
        setError(message);
      } else {
        Alert.alert("Location unavailable", message);
      }
    } finally {
      setLocating(false);
    }
  }

  function startEditing(item: Observation) {
  setEditingId(item.id);
  setTitle(item.title);
  setNotes(item.notes ?? "");
  setError("");
}

function cancelEditing() {
  setEditingId(null);
  setTitle("");
  setNotes("");
  setError("");
}

async function deleteObservation(item: Observation) {
  Alert.alert(
    "Delete observation",
    `Are you sure you want to delete "${item.title}"? This cannot be undone.`,
    [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void (async () => {
            setDeletingId(item.id);
            setError("");

            try {
              await request(
                `/projects/${projectId}/observations/${item.id}`,
                { method: "DELETE" }
              );

              if (editingId === item.id) {
                cancelEditing();
              }

              await loadObservations();

              Alert.alert("Deleted", "Observation deleted successfully.");
            } catch (err) {
              Alert.alert(
                "Delete failed",
                err instanceof Error
                  ? err.message
                  : "Could not delete observation."
              );
            } finally {
              setDeletingId(null);
            }
          })();
        },
      },
    ]
  );
}

  async function saveObservation() {
  if (!title.trim() || title.trim().length < 2) {
    Alert.alert(
      "Title required",
      "Enter a title with at least 2 characters."
    );
    return;
  }

  // Only a new observation requires a newly captured location.
  if (
    editingId === null &&
    (latitude === null || longitude === null)
  ) {
    Alert.alert(
      "Location required",
      "Capture the device location before saving."
    );
    return;
  }

  setSaving(true);
  setError("");

  try {
    if (editingId !== null) {
      // Update an existing observation.
      await request(
        `/projects/${projectId}/observations/${editingId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            title: title.trim(),
            notes: notes.trim() || null,
          }),
        }
      );

      cancelEditing();
      await loadObservations();

      Alert.alert("Success", "Observation updated successfully.");
    } else {
      // Create a new observation.
      await request(`/projects/${projectId}/observations`, {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          notes: notes.trim() || null,
          latitude,
          longitude,
        }),
      });

      setTitle("");
      setNotes("");
      setLatitude(null);
      setLongitude(null);
      setAccuracy(null);

      await loadObservations();

      Alert.alert("Success", "Field observation saved.");
    }
  } catch (err) {
    Alert.alert(
      editingId !== null ? "Update failed" : "Save failed",
      err instanceof Error
        ? err.message
        : "Could not save the observation."
    );
  } finally {
    setSaving(false);
  }
}

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>← Back</Text>
      </Pressable>

      <Text style={styles.heading}>Field observations</Text>
      <Text style={styles.subtitle}>{projectName}</Text>

      <Pressable
        style={styles.mapButton}
        onPress={() =>
          router.push({
            pathname: "/map",
            params: {
              projectId: String(projectId),
              projectName: String(projectName ?? "Project"),
            },
          } as unknown as Href)
        }
      >
        <Text style={styles.buttonText}>View observations on map</Text>
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
         {editingId !== null ? "Edit observation" : "New observation"}
        </Text>

        <Text style={styles.label}>Observation title</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Water point inspection"
          value={title}
          onChangeText={setTitle}
          maxLength={200}
        />

        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, styles.notes]}
          placeholder="Describe what you observed..."
          value={notes}
          onChangeText={setNotes}
          multiline
          textAlignVertical="top"
          maxLength={5000}
        />

        <Pressable
          style={[styles.locationButton, locating && styles.disabled]}
          onPress={() => void captureLocation()}
          disabled={locating}
        >
          <Text style={styles.buttonText}>
            {locating ? "Capturing location..." : "◎ Capture Current Location"}
          </Text>
        </Pressable>

        {latitude !== null && longitude !== null && (
          <View style={styles.coordinates}>
            <Text style={styles.coordinateTitle}>
              Location captured
            </Text>
            <Text style={styles.coordinateText}>
              Latitude: {latitude.toFixed(6)}
            </Text>
            <Text style={styles.coordinateText}>
              Longitude: {longitude.toFixed(6)}
            </Text>
            {accuracy !== null && (
              <Text style={styles.accuracy}>
                Reported accuracy: approximately {Math.round(accuracy)} m
              </Text>
            )}
          </View>
        )}

          <Pressable
            style={[styles.saveButton, saving && styles.disabled]}
            onPress={() => void saveObservation()}
            disabled={saving}
          >
            <Text style={styles.buttonText}>
              {saving
                ? editingId !== null
                  ? "Updating..."
                  : "Saving..."
                : editingId !== null
                  ? "Save Changes"
                  : "Save Observation"}
            </Text>
          </Pressable>

          {editingId !== null && (
            <Pressable
              style={styles.cancelButton}
              onPress={cancelEditing}
              disabled={saving}
            >
              <Text style={styles.cancelButtonText}>Cancel Editing</Text>
            </Pressable>
          )}
      </View>

      <View style={styles.listHeader}>
        <Text style={styles.sectionTitle}>Saved observations</Text>
        <Pressable onPress={() => void loadObservations()}>
          <Text style={styles.refresh}>Refresh</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator size="large" style={{ marginTop: 20 }} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : observations.length === 0 ? (
        <Text style={styles.empty}>No observations recorded yet.</Text>
      ) : (
        observations.map((item) => (
          <View key={item.id} style={styles.observationCard}>
            <Text style={styles.observationTitle}>{item.title}</Text>
            {!!item.notes && (
              <Text style={styles.observationNotes}>{item.notes}</Text>
            )}
            <Text style={styles.coordinateText}>
              {item.latitude.toFixed(6)}, {item.longitude.toFixed(6)}
            </Text>
            <Text style={styles.date}>
              {new Date(item.created_at).toLocaleString()}
            </Text>

            <View style={styles.actionRow}>
            <Pressable
              style={styles.editButton}
              onPress={() => startEditing(item)}
              disabled={saving || deletingId !== null}
            >
              <Text style={styles.buttonText}>Edit</Text>
            </Pressable>

            <Pressable
              style={[
                styles.deleteButton,
                deletingId === item.id && styles.disabled,
              ]}
              onPress={() => void deleteObservation(item)}
              disabled={saving || deletingId !== null}
            >
              <Text style={styles.buttonText}>
                {deletingId === item.id ? "Deleting..." : "Delete"}
              </Text>
            </Pressable>
          </View>
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
  heading: { fontSize: 27, fontWeight: "800", color: "#0F172A" },
  subtitle: { color: "#64748B", marginTop: 6, marginBottom: 20 },
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#0F172A" },
  label: { color: "#334155", fontWeight: "600", marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 9,
    padding: 12,
    backgroundColor: "#FFFFFF",
  },
  notes: { minHeight: 90 },
  locationButton: {
    backgroundColor: "#0F766E",
    padding: 14,
    alignItems: "center",
    borderRadius: 9,
    marginTop: 6,
  },
  saveButton: {
    backgroundColor: "#2563EB",
    padding: 14,
    alignItems: "center",
    borderRadius: 9,
    marginTop: 4,
  },
  mapButton: {
    backgroundColor: "#0F766E",
    padding: 14,
    alignItems: "center",
    borderRadius: 9,
    marginBottom: 16,
  },
  buttonText: { color: "#FFFFFF", fontWeight: "700" },
  disabled: { opacity: 0.6 },
  coordinates: {
    padding: 12,
    backgroundColor: "#ECFDF5",
    borderRadius: 9,
    gap: 4,
  },
  coordinateTitle: { color: "#047857", fontWeight: "700" },
  coordinateText: { color: "#334155", fontSize: 13 },
  accuracy: { color: "#64748B", fontSize: 12, marginTop: 3 },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 28,
    marginBottom: 12,
  },
  refresh: { color: "#2563EB", fontWeight: "600" },
  observationCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 6,
  },
  observationTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A" },
  observationNotes: { color: "#475569" },
  date: { color: "#94A3B8", fontSize: 12 },
  empty: { color: "#64748B", paddingVertical: 20, textAlign: "center" },
  error: { color: "#B91C1C", paddingVertical: 16 },

  actionRow: {
  flexDirection: "row",
  gap: 10,
  marginTop: 8,
},
editButton: {
  flex: 1,
  backgroundColor: "#2563EB",
  padding: 11,
  alignItems: "center",
  borderRadius: 8,
},
deleteButton: {
  flex: 1,
  backgroundColor: "#DC2626",
  padding: 11,
  alignItems: "center",
  borderRadius: 8,
},

cancelButton: {
  padding: 12,
  alignItems: "center",
  borderRadius: 9,
  borderWidth: 1,
  borderColor: "#CBD5E1",
  marginTop: 4,
},
cancelButtonText: {
  color: "#475569",
  fontWeight: "700",
},
});
