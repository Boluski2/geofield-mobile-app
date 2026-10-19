
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import * as Location from "expo-location";

type Coordinates = {
  latitude: number;
  longitude: number;
};

// Calculate distance between two GPS positions using the Haversine formula.
function calculateDistance(
  start: Coordinates,
  end: Coordinates
): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadius = 6371000;

  const latDifference = toRadians(
    end.latitude - start.latitude
  );
  const lonDifference = toRadians(
    end.longitude - start.longitude
  );

  const a =
    Math.sin(latDifference / 2) ** 2 +
    Math.cos(toRadians(start.latitude)) *
      Math.cos(toRadians(end.latitude)) *
      Math.sin(lonDifference / 2) ** 2;

  const safeA = Math.min(1, Math.max(0, a));

  return (
    2 *
    earthRadius *
    Math.atan2(Math.sqrt(safeA), Math.sqrt(1 - safeA))
  );
}

// Calculate the compass bearing from your location to the observation.
function calculateBearing(
  start: Coordinates,
  end: Coordinates
): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const toDegrees = (radians: number) => (radians * 180) / Math.PI;

  const lat1 = toRadians(start.latitude);
  const lat2 = toRadians(end.latitude);
  const lonDifference = toRadians(
    end.longitude - start.longitude
  );

  const y = Math.sin(lonDifference) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(lonDifference);

  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

function getCompassDirection(bearing: number): string {
  const directions = [
    "N",
    "NE",
    "E",
    "SE",
    "S",
    "SW",
    "W",
    "NW",
  ];

  return directions[Math.round(bearing / 45) % 8];
}

export default function ObservationDetailsScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    id: string;
    projectId: string;
    projectName?: string;
    title: string;
    notes?: string;
    latitude: string;
    longitude: string;
    status: string;
    createdAt: string;
  }>();

  const latitude = Number(params.latitude);
  const longitude = Number(params.longitude);

  const validCoordinates =
    params.latitude?.trim() !== "" &&
    params.longitude?.trim() !== "" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180;

  const createdDate = new Date(params.createdAt);
  const validDate = !Number.isNaN(createdDate.getTime());

  const status =
    params.status === "reviewed" ? "Reviewed" : "Pending";

  const [currentLocation, setCurrentLocation] =
    useState<Coordinates | null>(null);

  const [distance, setDistance] = useState<number | null>(null);
  const [bearing, setBearing] = useState<number | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);

  async function calculateDistanceFromMyLocation() {
    if (!validCoordinates) {
      Alert.alert(
        "Invalid coordinates",
        "This observation does not have valid GPS coordinates."
      );
      return;
    }

    try {
      setLocationLoading(true);

      let permission =
        await Location.getForegroundPermissionsAsync();

      if (permission.status !== "granted") {
        permission =
          await Location.requestForegroundPermissionsAsync();
      }

      if (permission.status !== "granted") {
        Alert.alert(
          "Location permission required",
          "Allow location access in your Android settings to calculate your distance from this observation."
        );
        return;
      }

      const servicesEnabled =
        await Location.hasServicesEnabledAsync();

      if (!servicesEnabled) {
        Alert.alert(
          "GPS is turned off",
          "Please enable Location on your Android device and try again."
        );
        return;
      }

      const position =
        await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

      const current = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      const target = { latitude, longitude };

      setCurrentLocation(current);
      setDistance(calculateDistance(current, target));
      setBearing(calculateBearing(current, target));
    } catch (error) {
      Alert.alert(
        "Unable to get location",
        error instanceof Error
          ? error.message
          : "Please check your GPS settings and try again."
      );
    } finally {
      setLocationLoading(false);
    }
  }

  async function navigateToObservation() {
    if (!validCoordinates) {
      Alert.alert(
        "Invalid coordinates",
        "This observation does not have valid GPS coordinates."
      );
      return;
    }

    const url =
      `https://www.google.com/maps/dir/?api=1` +
      `&destination=${latitude},${longitude}` +
      `&travelmode=walking`;

    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        "Unable to open navigation",
        "Please check that a browser or Google Maps is available on your device."
      );
    }
  }

  const formattedDistance =
    distance === null
      ? null
      : distance < 1000
        ? `${Math.round(distance)} metres`
        : `${(distance / 1000).toFixed(2)} km`;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable onPress={() => router.back()}>
        <Text style={styles.back}>← Back to observations</Text>
      </Pressable>

      <Text style={styles.heading}>Observation Details</Text>
      <Text style={styles.subtitle}>
        {params.projectName || "Field Project"}
      </Text>

      <View style={styles.card}>
        <Text style={styles.label}>Observation title</Text>
        <Text style={styles.title}>
          {params.title || "Untitled"}
        </Text>

        <Text style={styles.label}>Notes</Text>
        <Text style={styles.notes}>
          {params.notes?.trim() || "No notes provided."}
        </Text>

        <Text style={styles.label}>Review status</Text>
        <View
          style={[
            styles.badge,
            params.status === "reviewed"
              ? styles.reviewed
              : styles.pending,
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              params.status === "reviewed"
                ? styles.reviewedText
                : styles.pendingText,
            ]}
          >
            {status}
          </Text>
        </View>

        <Text style={styles.label}>GPS coordinates</Text>
        <Text style={styles.coordinate}>
          Latitude:{" "}
          {validCoordinates ? latitude.toFixed(6) : "Unavailable"}
        </Text>
        <Text style={styles.coordinate}>
          Longitude:{" "}
          {validCoordinates ? longitude.toFixed(6) : "Unavailable"}
        </Text>

        <Text style={styles.label}>Observation ID</Text>
        <Text style={styles.coordinate}>
          {params.id || "Unavailable"}
        </Text>

        <Text style={styles.label}>Date recorded</Text>
        <Text style={styles.coordinate}>
          {validDate
            ? createdDate.toLocaleString()
            : "Unavailable"}
        </Text>
      </View>

      <View style={styles.navigationCard}>
        <Text style={styles.navigationHeading}>
          GPS Navigation
        </Text>

        <Text style={styles.navigationDescription}>
          Find out how far you are from this observation.
        </Text>

        {distance !== null && (
          <View style={styles.result}>
            <Text style={styles.distanceLabel}>
              Distance from your location
            </Text>
            <Text style={styles.distanceValue}>
              {formattedDistance}
            </Text>

            {bearing !== null && (
              <Text style={styles.direction}>
                Direction: {getCompassDirection(bearing)} (
                {Math.round(bearing)}°)
              </Text>
            )}

            <Text style={styles.accuracyNote}>
              Straight-line GPS distance, not road distance.
            </Text>
          </View>
        )}

        <Pressable
          style={[
            styles.locationButton,
            locationLoading && styles.disabledButton,
          ]}
          onPress={calculateDistanceFromMyLocation}
          disabled={locationLoading}
        >
          <Text style={styles.buttonText}>
            {locationLoading
              ? "Getting your location..."
              : distance !== null
                ? "Refresh Distance"
                : "Calculate Distance"}
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.navigationButton,
            !validCoordinates && styles.disabledButton,
          ]}
          onPress={navigateToObservation}
          disabled={!validCoordinates}
        >
          <Text style={styles.buttonText}>
            Navigate with Google Maps
          </Text>
        </Pressable>
      </View>

      <Pressable
        style={styles.mapButton}
        onPress={() =>
          router.push({
            pathname: "/map",
            params: {
              projectId: params.projectId,
              projectName: params.projectName || "Field Project",
              observationId: params.id,
            },
          })
        }
      >
        <Text style={styles.buttonText}>
          View Project Observations on Map
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingTop: 32,
    paddingBottom: 48,
    flexGrow: 1,
    backgroundColor: "#F8FAFC",
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
  },
  back: {
    color: "#2563EB",
    fontWeight: "600",
    marginBottom: 20,
  },
  heading: {
    fontSize: 27,
    fontWeight: "800",
    color: "#0F172A",
  },
  subtitle: {
    color: "#64748B",
    marginTop: 6,
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  label: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 10,
  },
  title: {
    color: "#0F172A",
    fontSize: 21,
    fontWeight: "700",
  },
  notes: {
    color: "#334155",
    fontSize: 15,
    lineHeight: 23,
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pending: {
    backgroundColor: "#FEF3C7",
  },
  reviewed: {
    backgroundColor: "#D1FAE5",
  },
  badgeText: {
    fontSize: 13,
    fontWeight: "700",
  },
  pendingText: {
    color: "#92400E",
  },
  reviewedText: {
    color: "#065F46",
  },
  coordinate: {
    color: "#334155",
    fontSize: 14,
  },
  navigationCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 14,
    padding: 16,
    marginTop: 18,
    gap: 12,
  },
  navigationHeading: {
    color: "#0F172A",
    fontSize: 20,
    fontWeight: "800",
  },
  navigationDescription: {
    color: "#64748B",
    fontSize: 14,
    lineHeight: 21,
  },
  result: {
    backgroundColor: "#F0FDFA",
    borderRadius: 10,
    padding: 14,
    gap: 6,
  },
  distanceLabel: {
    color: "#0F766E",
    fontSize: 13,
    fontWeight: "600",
  },
  distanceValue: {
    color: "#115E59",
    fontSize: 28,
    fontWeight: "800",
  },
  direction: {
    color: "#115E59",
    fontSize: 15,
    fontWeight: "700",
  },
  accuracyNote: {
    color: "#64748B",
    fontSize: 12,
    lineHeight: 18,
  },
  locationButton: {
    backgroundColor: "#0F766E",
    padding: 14,
    alignItems: "center",
    borderRadius: 9,
  },
  navigationButton: {
    backgroundColor: "#2563EB",
    padding: 14,
    alignItems: "center",
    borderRadius: 9,
  },
  mapButton: {
    backgroundColor: "#475569",
    padding: 14,
    alignItems: "center",
    borderRadius: 9,
    marginTop: 18,
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    textAlign: "center",
  },
});
