
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

export type ObservationPoint = {
  id: number;
  title: string;
  notes?: string | null;
  latitude: number;
  longitude: number;
  created_at?: string;
};

type Props = {
  observations: ObservationPoint[];
  userLocation?: {
    latitude: number;
    longitude: number;
  } | null;
  accuracy?: number | null;
  onSelectObservation?: (item: ObservationPoint) => void;
  selectedObservationId?: number | null;
};

export default function ObservationMap({
  observations,
  userLocation = null,
  accuracy = null,
  onSelectObservation,
  selectedObservationId = null,
}: Props) {
  const html = useMemo(() => {
    const validObservations = observations.filter(
      (item) =>
        Number.isFinite(Number(item.latitude)) &&
        Number.isFinite(Number(item.longitude)) &&
        Math.abs(Number(item.latitude)) <= 90 &&
        Math.abs(Number(item.longitude)) <= 180
    );

    const validUserLocation =
      userLocation &&
      Number.isFinite(userLocation.latitude) &&
      Number.isFinite(userLocation.longitude) &&
      Math.abs(userLocation.latitude) <= 90 &&
      Math.abs(userLocation.longitude) <= 180
        ? userLocation
        : null;

    const first = validObservations[0];
    const centerLat = validUserLocation?.latitude ??
      Number(first?.latitude ?? 6.5244);
    const centerLon = validUserLocation?.longitude ??
      Number(first?.longitude ?? 3.3792);

    const safeObservations = JSON.stringify(
      validObservations.map((item) => ({
        id: item.id,
        title: String(item.title ?? "Untitled observation"),
        notes: String(item.notes ?? ""),
        latitude: Number(item.latitude),
        longitude: Number(item.longitude),
        created_at: item.created_at ?? "",
      }))
    ).replace(/</g, "\\u003c");

    const safeUserLocation = JSON.stringify(validUserLocation)
      .replace(/</g, "\\u003c");

    const safeAccuracy =
      Number.isFinite(accuracy) && Number(accuracy) >= 0
        ? Number(accuracy)
        : null;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport"
            content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
          <link rel="stylesheet"
            href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
          <style>
            html, body, #map {
              height: 100%;
              width: 100%;
              margin: 0;
              padding: 0;
            }
            .leaflet-popup-content {
              font-size: 14px;
              line-height: 1.5;
              overflow-wrap: anywhere;
            }
            .my-location-dot {
              width: 18px;
              height: 18px;
              background: #2563eb;
              border: 3px solid white;
              border-radius: 50%;
              box-shadow: 0 0 0 2px #2563eb;
            }
          </style>
        </head>
        <body>
          <div id="map"></div>
          <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
          <script>
            const observations = ${safeObservations};
            const userLocation = ${safeUserLocation};
            const accuracy = ${safeAccuracy};

            const map = L.map("map").setView(
              [${centerLat}, ${centerLon}], 13
            );

            L.tileLayer(
              "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
              {
                maxZoom: 19,
                attribution: "&copy; OpenStreetMap contributors"
              }
            ).addTo(map);

            const boundsPoints = [];

            function sendSelection(item) {
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(
                  JSON.stringify({
                    type: "selectObservation",
                    observation: item
                  })
                );
              }
            }

            observations.forEach((item) => {
              const marker = L.marker([
                item.latitude,
                item.longitude
              ]).addTo(map);

              const popup = document.createElement("div");
              const title = document.createElement("strong");
              title.textContent = item.title;

              const notes = document.createElement("p");
              notes.textContent = item.notes || "No notes added.";

              const coords = document.createElement("small");
              coords.textContent =
                "Lat: " + item.latitude.toFixed(6) +
                " | Lon: " + item.longitude.toFixed(6);

              popup.append(title, notes, coords);
              marker.bindPopup(popup);

              marker.on("click", () => sendSelection(item));

              boundsPoints.push([
                item.latitude,
                item.longitude
              ]);
            });

            if (userLocation) {
              const position = [
                userLocation.latitude,
                userLocation.longitude
              ];

              if (accuracy !== null && accuracy > 0) {
                L.circle(position, {
                  radius: accuracy,
                  color: "#2563eb",
                  fillColor: "#60a5fa",
                  fillOpacity: 0.15,
                  weight: 1
                }).addTo(map);
              }

              const locationIcon = L.divIcon({
                className: "",
                html: '<div class="my-location-dot"></div>',
                iconSize: [18, 18],
                iconAnchor: [9, 9]
              });

              L.marker(position, { icon: locationIcon })
                .addTo(map)
                .bindPopup("Your current location");

              boundsPoints.push(position);
            }

            if (boundsPoints.length > 1) {
              map.fitBounds(boundsPoints, {
                padding: [30, 30],
                maxZoom: 16
              });
            } else if (boundsPoints.length === 1) {
              map.setView(boundsPoints[0], 15);
            }
          </script>
        </body>
      </html>
    `;
  }, [observations, userLocation, accuracy]);

  function handleMessage(event: WebViewMessageEvent) {
    try {
      const message = JSON.parse(event.nativeEvent.data);

      if (message.type !== "selectObservation" ||
          !message.observation) {
        return;
      }

      const id = Number(message.observation.id);
      const selected = observations.find(
        (item) => Number(item.id) === id
      );

      if (selected) {
        onSelectObservation?.(selected);
      }
    } catch {
      // Ignore messages that are not valid JSON.
    }
  }

  return (
    <View style={styles.container}>
      <WebView
        source={{ html }}
        style={styles.map}
        originWhitelist={["*"]}
        javaScriptEnabled
        domStorageEnabled
        onMessage={handleMessage}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <Text>Loading OpenStreetMap...</Text>
          </View>
        )}
      />

      {observations.length === 0 && !userLocation && (
        <View style={styles.empty}>
          <Text>No observations or current location to display.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 350,
    overflow: "hidden",
    borderRadius: 12,
  },
  map: {
    flex: 1,
    backgroundColor: "#E5E7EB",
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    position: "absolute",
    top: 10,
    left: 10,
    right: 10,
    backgroundColor: "white",
    padding: 10,
    borderRadius: 8,
  },
});
