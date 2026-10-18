
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as SecureStore from "expo-secure-store";
import * as Location from "expo-location";
import ObservationMap, {
  type ObservationPoint,
} from "../components/ObservationMap";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function MapScreen() {
  const { projectId, projectName } = useLocalSearchParams<{
    projectId: string;
    projectName?: string;
  }>();

  const [observations, setObservations] = useState<ObservationPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [selectedObservation, setSelectedObservation] =
  useState<ObservationPoint | null>(null);

  const loadObservations = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      if (!projectId || !API_URL) {
        throw new Error("Project ID or API URL is missing.");
      }

      const token = await SecureStore.getItemAsync("access_token");

      if (!token) {
        throw new Error("Login session not found. Please log in again.");
      }

      const response = await fetch(
        `${API_URL.replace(/\/$/, "")}/projects/${encodeURIComponent(projectId)}/observations`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          `Unable to load observations (HTTP ${response.status}).`
        );
      }

      const data = await response.json();
      const items = Array.isArray(data) ? data : data?.observations;

      if (!Array.isArray(items)) {
        throw new Error("The API did not return an observations list.");
      }

      setObservations(items);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load observations."
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadObservations();
  }, [loadObservations]);

  const locateMe = useCallback(async () => {
    try {
      setLocating(true);
      setLocationError("");

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

      setUserLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });

      setAccuracy(position.coords.accuracy);
    } catch (err) {
      setLocationError(
        err instanceof Error
          ? err.message
          : "Unable to get your current location."
      );
    } finally {
      setLocating(false);
    }
  }, []);

  return (
    <ScrollView
  style={styles.screen}
  contentContainerStyle={styles.screenContent}
>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>

        <Text style={styles.heading}>
          {projectName || "Project"} Map
        </Text>

        <Text style={styles.subtitle}>
          {observations.length} field observation(s)
        </Text>

        <View style={styles.actions}>
          <Pressable
            style={[styles.actionButton, loading && styles.disabled]}
            onPress={() => void loadObservations()}
            disabled={loading}
          >
            <Text style={styles.actionText}>
              {loading ? "Refreshing..." : "↻ Refresh observations"}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.locationButton, locating && styles.disabled]}
            onPress={() => void locateMe()}
            disabled={locating}
          >
            <Text style={styles.locationText}>
              {locating
                ? "Getting location..."
                : userLocation
                  ? "◎ Update my location"
                  : "◎ My location"}
            </Text>
          </Pressable>
        </View>

        {!!locationError && (
          <Text style={styles.locationError}>{locationError}</Text>
        )}

        {userLocation && (
          <Text style={styles.locationInfo}>
            GPS: {userLocation.latitude.toFixed(6)},{" "}
            {userLocation.longitude.toFixed(6)}
            {accuracy !== null
              ? ` · Accuracy approximately ${Math.round(accuracy)} m`
              : ""}
          </Text>
        )}
      </View>

      {loading && observations.length === 0 ? (
        <View style={styles.message}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text>Loading observations...</Text>
        </View>
      ) : error && observations.length === 0 ? (
        <View style={styles.message}>
          <Text style={styles.error}>{error}</Text>
          <Pressable
            style={styles.retry}
            onPress={() => void loadObservations()}
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {!!error && (
            <Text style={styles.refreshError}>
              Refresh failed: {error}
            </Text>
          )}

          <View style={styles.mapContainer}>
            <ObservationMap
            observations={observations}
            userLocation={userLocation}
            accuracy={accuracy}
            onSelectObservation={setSelectedObservation}
            selectedObservationId={selectedObservation?.id ?? null}
          />
          </View>
          {selectedObservation && (
  <View style={styles.detailsCard}>
    <View style={styles.detailsHeader}>
      <Text style={styles.detailsHeading}>
        Observation details
      </Text>

      <Pressable onPress={() => setSelectedObservation(null)}>
        <Text style={styles.closeText}>Close</Text>
      </Pressable>
    </View>

    <Text style={styles.detailsTitle}>
      {selectedObservation.title}
    </Text>

    <Text style={styles.detailsNotes}>
      {selectedObservation.notes || "No notes added."}
    </Text>

    <Text style={styles.detailsCoordinates}>
      Latitude: {Number(selectedObservation.latitude).toFixed(6)}
    </Text>

    <Text style={styles.detailsCoordinates}>
      Longitude: {Number(selectedObservation.longitude).toFixed(6)}
    </Text>

    {selectedObservation.created_at && (
      <Text style={styles.detailsDate}>
        Recorded:{" "}
        {new Date(selectedObservation.created_at).toLocaleString()}
      </Text>
    )}
  </View>
)}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    padding: 16,
    gap: 6,
  },
  back: {
    color: "#2563EB",
    fontSize: 16,
    marginBottom: 6,
  },
  heading: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0F172A",
  },
  subtitle: {
    color: "#64748B",
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    backgroundColor: "#DBEAFE",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  actionText: {
    color: "#1D4ED8",
    fontWeight: "600",
  },
  locationButton: {
    backgroundColor: "#0F766E",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  locationText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  disabled: {
    opacity: 0.6,
  },
  locationInfo: {
    fontSize: 12,
    color: "#475569",
    marginTop: 4,
  },
  locationError: {
    color: "#B91C1C",
    fontSize: 13,
    marginTop: 4,
  },
  refreshError: {
    color: "#B91C1C",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  mapContainer: {
    flex: 1,
    minHeight: 350,
    marginHorizontal: 12,
    marginBottom: 12,
    overflow: "hidden",
    borderRadius: 12,
  },
  screenContent: {
  flexGrow: 1,
  paddingBottom: 22,
},
  message: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 20,
  },
  error: {
    color: "#DC2626",
    textAlign: "center",
  },
  retry: {
    backgroundColor: "#DBEAFE",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    color: "#1D4ED8",
    fontWeight: "600",
  },

  detailsCard: {
  backgroundColor: "#FFFFFF",
  borderWidth: 1,
  borderColor: "#CBD5E1",
  borderRadius: 12,
  padding: 14,
  marginHorizontal: 12,
  marginBottom: 20,
  gap: 8,
},
detailsHeader: {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
},
detailsHeading: {
  fontSize: 14,
  color: "#64748B",
  fontWeight: "600",
},
closeText: {
  color: "#2563EB",
  fontWeight: "600",
},
detailsTitle: {
  fontSize: 18,
  color: "#0F172A",
  fontWeight: "700",
},
detailsNotes: {
  color: "#475569",
},
detailsCoordinates: {
  fontSize: 13,
  color: "#334155",
},
detailsDate: {
  fontSize: 12,
  color: "#64748B",
},
});
