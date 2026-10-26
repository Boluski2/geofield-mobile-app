
  import {
    useCallback,
    useEffect,
    useMemo,
    useState,
  } from "react";
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
  import * as FileSystem from  "expo-file-system/legacy"
  import * as Sharing from "expo-sharing";

  type Observation = {
    id: number;
    project_id: number;
    title: string;
    notes?: string | null;
    latitude: number;
    longitude: number;
    status: "pending" | "reviewed";
    created_at: string;
  };

  type DashboardStats = {
  total_observations: number;
  pending_observations: number;
  reviewed_observations: number;
  review_percentage: number;
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
    const [searchText, setSearchText] = useState("");
    const [dateFilter, setDateFilter] = useState("");
    const [locating, setLocating] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [editingId, setEditingId] = useState<number | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "reviewed"
  >("all");
  const [dashboardStats, setDashboardStats] =
  useState<DashboardStats | null>(null);
  const [exporting, setExporting] = useState(false);

const [statsLoading, setStatsLoading] = useState(true);

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


  const loadDashboardStats = useCallback(async () => {
  setStatsLoading(true);

  try {
    const data = await request("/dashboard/observation-stats");

    setDashboardStats(data);
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Could not load dashboard statistics."
    );
  } finally {
    setStatsLoading(false);
  }
}, [request]);




const exportObservationsCSV = async () => {
  setExporting(true);
  setError("");

  try {
    const token = await getAccessToken();

    if (!token) {
      throw new Error("Please log in again to export observations.");
    }

    const response = await fetch(
      `${API_URL}/observations/export/csv?status=${statusFilter}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));

      throw new Error(
        data.detail || `Export failed: ${response.status}`
      );
    }


    const csv = await response.text();

const contentDisposition =
  response.headers.get("Content-Disposition");

const filenameMatch = contentDisposition?.match(
  /filename="?([^";]+)"?/i
);

const fileName =
  filenameMatch?.[1] ?? "geofield_observations.csv";

const fileUri = `${FileSystem.cacheDirectory}${fileName}`;

    await FileSystem.writeAsStringAsync(fileUri, csv, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const canShare = await Sharing.isAvailableAsync();

    if (!canShare) {
      throw new Error("File sharing is not available on this device.");
    }

    await Sharing.shareAsync(fileUri, {
      mimeType: "text/csv",
      dialogTitle: "Export GeoField Observations",
      UTI: "public.comma-separated-values-text",
    });
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Could not export observations."
    );
  } finally {
    setExporting(false);
  }
};


useEffect(() => {
  loadObservations();
  loadDashboardStats();
}, [loadObservations, loadDashboardStats]);


    const filteredObservations = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    const selectedDate = dateFilter.trim();

    // Only accept a complete date in YYYY-MM-DD format.
    const validDate =
      selectedDate === "" ||
      (
        /^\d{4}-\d{2}-\d{2}$/.test(selectedDate) &&
        (() => {
          const parsed = new Date(`${selectedDate}T00:00:00Z`);

          return (
            !Number.isNaN(parsed.getTime()) &&
            parsed.toISOString().slice(0, 10) === selectedDate
          );
        })()
      );

    if (!validDate) {
      return [];
    }

    return observations.filter((item) => {
      const matchesSearch =
        item.title.toLowerCase().includes(query) ||
        (item.notes ?? "").toLowerCase().includes(query);

      const createdDate = new Date(item.created_at);

      const matchesStatus =
            statusFilter === "all" || item.status === statusFilter;

      const localDate = [
        createdDate.getFullYear(),
        String(createdDate.getMonth() + 1).padStart(2, "0"),
        String(createdDate.getDate()).padStart(2, "0"),
      ].join("-");

      const matchesDate =
        selectedDate === "" || localDate === selectedDate;

      return matchesSearch && matchesDate && matchesStatus;
    });
  }, [observations, searchText, dateFilter, statusFilter]);


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

  async function toggleObservationStatus(item: Observation) {
    const newStatus =
      item.status === "reviewed" ? "pending" : "reviewed";

    try {
      await request(
        `/projects/${projectId}/observations/${item.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            title: item.title,
            notes: item.notes ?? null,
            status: newStatus,
          }),
        }
      );

      await loadObservations();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not update observation status."
      );
    }
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


              <View style={styles.dashboardSection}>
              <Text style={styles.dashboardTitle}>
                Observation Dashboard
              </Text>

              {statsLoading ? (
                <ActivityIndicator size="small" />
              ) : dashboardStats ? (
                <>
                  <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                      <Text style={styles.statLabel}>Total</Text>
                      <Text style={styles.statValue}>
                        {dashboardStats.total_observations}
                      </Text>
                    </View>

                    <View style={styles.statCard}>
                      <Text style={styles.statLabel}>Pending</Text>
                      <Text style={styles.statValue}>
                        {dashboardStats.pending_observations}
                      </Text>
                    </View>

                    <View style={styles.statCard}>
                      <Text style={styles.statLabel}>Reviewed</Text>
                      <Text style={styles.statValue}>
                        {dashboardStats.reviewed_observations}
                      </Text>
                    </View>

                    <View style={styles.statCard}>
                      <Text style={styles.statLabel}>Review Progress</Text>
                      <Text style={styles.statValue}>
                        {dashboardStats.review_percentage}%
                      </Text>
                    </View>
                  </View>

                  <Pressable
                    onPress={loadDashboardStats}
                    style={styles.refreshStatsButton}
                  >
                    <Text style={styles.refreshStatsText}>
                      Refresh Statistics
                    </Text>
                  </Pressable>
                </>
              ) : (
                <Pressable
                  onPress={loadDashboardStats}
                  style={styles.refreshStatsButton}
                >
                  <Text style={styles.refreshStatsText}>
                    Retry Loading Statistics
                  </Text>
                </Pressable>
              )}
            </View>

            <Pressable
              onPress={exportObservationsCSV}
              disabled={exporting}
              style={[
                styles.exportButton,
                exporting && { opacity: 0.6 },
              ]}
            >
              {exporting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.exportButtonText}>
                  Export Observations to CSV
                </Text>
              )}
            </Pressable>



            <View style={styles.filterCard}>
            <Text style={styles.label}>Search observations</Text>

            <TextInput
              style={styles.input}
              placeholder="Search title or notes..."
              value={searchText}
              onChangeText={setSearchText}
              autoCapitalize="none"
              clearButtonMode="while-editing"
            />

            <Text style={styles.label}>Filter by date</Text>

            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD, e.g. 2026-10-18"
              value={dateFilter}
              onChangeText={setDateFilter}
              maxLength={10}
            />

            <Text style={styles.resultCount}>
              {filteredObservations.length} matching observation(s)
            </Text>

            {(searchText !== "" || dateFilter !== "") && (
              <Pressable
                style={styles.clearFilters}
                onPress={() => {
                  setSearchText("");
                  setDateFilter("");
                        }}
                      >
                        <Text style={styles.clearFiltersText}>Clear filters</Text>
                      </Pressable>
                    )}
                  </View>

                  <View style={styles.statusFilterRow}>
            {(["all", "pending", "reviewed"] as const).map((status) => {
              const active = statusFilter === status;

              const label =
                status === "all"
                  ? "All"
                  : status === "pending"
                    ? "Pending"
                    : "Reviewed";

              return (
                <Pressable
                  key={status}
                  onPress={() => setStatusFilter(status)}
                  style={[
                    styles.statusFilterButton,
                    active && styles.statusFilterButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusFilterText,
                      active && styles.statusFilterTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

        {loading ? (
          <ActivityIndicator size="large" style={{ marginTop: 20 }} />
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
          ) : filteredObservations.length === 0 ? (
            <Text style={styles.empty}>
              {observations.length === 0
                ? "No observations recorded yet."
                : "No observations match your search or date filter."}
            </Text>
          ) : (
          filteredObservations.map((item) => (
            <View key={item.id} style={styles.observationCard}>
              <Text style={styles.observationTitle}>{item.title}</Text>
              {!!item.notes && (
                <Text style={styles.observationNotes}>{item.notes}</Text>
              )}
              <View style={styles.statusRow}>
                <Text
                  style={[
                    styles.statusBadge,
                    item.status === "reviewed"
                      ? styles.reviewedBadge
                      : styles.pendingBadge,
                  ]}
                >
                  {item.status === "reviewed" ? "Reviewed" : "Pending"}
                </Text>

                <Pressable
                  style={styles.statusButton}
                  onPress={() => void toggleObservationStatus(item)}
                >
                  <Text style={styles.statusButtonText}>
                    {item.status === "reviewed"
                      ? "Mark as Pending"
                      : "Mark as Reviewed"}
                  </Text>
                </Pressable>
              </View>
              <Text style={styles.coordinateText}>
                {item.latitude.toFixed(6)}, {item.longitude.toFixed(6)}
              </Text>
              <Text style={styles.date}>
                {new Date(item.created_at).toLocaleString()}
              </Text>

              <View style={styles.actionRow}>


                <Pressable
                  style={styles.detailButton}
                  onPress={() =>
                    router.push({
                      pathname: "/observation-details",
                      params: {
                        id: String(item.id),
                        projectId: String(projectId),
                        projectName: String(projectName),
                        title: item.title,
                        notes: item.notes ?? "",
                        latitude: String(item.latitude),
                        longitude: String(item.longitude),
                        status: item.status,
                        createdAt: item.created_at,
                      },
                    })
                  }
                >
                  <Text style={styles.buttonText}>View Details</Text>
                </Pressable>

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
      backgroundColor: "#f5f7f3",
    },
    back: { color: "#205a46", fontWeight: "600", marginBottom: 20 },
    heading: { fontSize: 27, fontWeight: "800", color: "#18352c" },
    subtitle: { color: "#718078", marginTop: 6, marginBottom: 20 },
    card: {
      backgroundColor: "#FFFFFF",
      borderWidth: 1,
      borderColor: "#e5ebe6",
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
      backgroundColor: "#205a46",
      padding: 14,
      alignItems: "center",
      borderRadius: 9,
      marginTop: 6,
    },
    saveButton: {
      backgroundColor: "#205a46",
      padding: 14,
      alignItems: "center",
      borderRadius: 9,
      marginTop: 4,
    },
    mapButton: {
      backgroundColor: "#205a46",
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
    refresh: { color: "#205a46", fontWeight: "600" },
    observationCard: {
      backgroundColor: "#FFFFFF",
      borderWidth: 1,
      borderColor: "#e5ebe6",
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
      gap: 6,
    },
    observationTitle: { fontSize: 16, fontWeight: "700", color: "#18352c" },
    observationNotes: { color: "#596c61" },
    statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    overflow: "hidden",
    fontSize: 12,
    fontWeight: "700",
  },
  pendingBadge: {
    backgroundColor: "#FEF3C7",
    color: "#92400E",
  },
  reviewedBadge: {
    backgroundColor: "#D1FAE5",
    color: "#065F46",
  },
  statusButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#64748B",
  },
  statusButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
  },
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

  filterCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginBottom: 12,
  },
  resultCount: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "600",
  },
  clearFilters: {
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "#EFF6FF",
  },
  clearFiltersText: {
    color: "#2563EB",
    fontWeight: "700",
  },
  statusFilterRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    marginBottom: 8,
  },
  statusFilterButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
  },
  statusFilterButtonActive: {
    backgroundColor: "#1D4ED8",
    borderColor: "#1D4ED8",
  },
  statusFilterText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  statusFilterTextActive: {
    color: "#FFFFFF",
  },
  dashboardSection: {
  marginBottom: 20,
},
dashboardTitle: {
  fontSize: 20,
  fontWeight: "700",
  color: "#0F172A",
  marginBottom: 12,
},
statsGrid: {
  flexDirection: "row",
  flexWrap: "wrap",
  gap: 10,
},
statCard: {
  width: "48%",
  flexGrow: 1,
  flexBasis: "45%",
  minHeight: 100,
  padding: 14,
  borderRadius: 12,
  backgroundColor: "#F1F5F9",
  borderWidth: 1,
  borderColor: "#E2E8F0",
  justifyContent: "center",
},
statLabel: {
  fontSize: 13,
  color: "#475569",
  marginBottom: 8,
},
statValue: {
  fontSize: 25,
  fontWeight: "700",
  color: "#1D4ED8",
},
refreshStatsButton: {
  alignSelf: "flex-start",
  marginTop: 12,
  paddingVertical: 10,
  paddingHorizontal: 14,
  borderRadius: 8,
  backgroundColor: "#1D4ED8",
},
refreshStatsText: {
  color: "#FFFFFF",
  fontSize: 13,
  fontWeight: "600",
},

exportButton: {
  marginTop: 12,
  paddingVertical: 14,
  paddingHorizontal: 16,
  borderRadius: 10,
  backgroundColor: "#047857",
  alignItems: "center",
  justifyContent: "center",
},
exportButtonText: {
  color: "#FFFFFF",
  fontSize: 14,
  fontWeight: "700",
},

detailButton: {
  flex: 1,
  backgroundColor: "#0F766E",
  padding: 11,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 8,
},

  });
