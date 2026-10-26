import {
  Alert,
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import * as SecureStore from "expo-secure-store";
import { File } from "expo-file-system";
import { Image } from "expo-image";
import * as Crypto from "expo-crypto";

type Coordinates = {
  latitude: number;
  longitude: number;
};

type SavedPhoto = {
  id: number;
  observation_id: number;
  filename: string;
  content_type: string;
  caption: string | null;
  created_at: string;
};

type PhotoResponse = {
  photos?: SavedPhoto[];
  detail?: string;
  message?: string;
};

function calculateDistance(
  start: Coordinates,
  end: Coordinates
): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadius = 6371000;

  const latDifference = toRadians(end.latitude - start.latitude);
  const lonDifference = toRadians(end.longitude - start.longitude);

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

function calculateBearing(
  start: Coordinates,
  end: Coordinates
): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const toDegrees = (radians: number) => (radians * 180) / Math.PI;

  const lat1 = toRadians(start.latitude);
  const lat2 = toRadians(end.latitude);
  const lonDifference = toRadians(end.longitude - start.longitude);

  const y = Math.sin(lonDifference) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(lonDifference);

  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

function getCompassDirection(bearing: number): string {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return directions[Math.round(bearing / 45) % 8];
}

export default function ObservationDetailsScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    id: string | string[];
    projectId: string | string[];
    projectName?: string | string[];
    title: string | string[];
    notes?: string | string[];
    latitude: string | string[];
    longitude: string | string[];
    status: string | string[];
    createdAt: string | string[];
  }>();

  const getParam = (
    value: string | string[] | undefined
  ): string => {
    return Array.isArray(value) ? value[0] ?? "" : value ?? "";
  };

  const observationId = getParam(params.id);
  const projectId = getParam(params.projectId);
  const projectName = getParam(params.projectName);
  const title = getParam(params.title);
  const notes = getParam(params.notes);
  const latitudeText = getParam(params.latitude);
  const longitudeText = getParam(params.longitude);
  const observationStatus = getParam(params.status);
  const createdAt = getParam(params.createdAt);

  const apiUrl = process.env.EXPO_PUBLIC_API_URL;

  const [savedPhotos, setSavedPhotos] = useState<SavedPhoto[]>([]);
  const [photoToken, setPhotoToken] = useState<string | null>(null);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [failedPhotoIds, setFailedPhotoIds] = useState<number[]>([]);
  const [selectedPhoto, setSelectedPhoto] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const uploadLock = useRef(false);
  const uploadIdempotencyKey = useRef<string | null>(null);

  const [currentLocation, setCurrentLocation] =
    useState<Coordinates | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [bearing, setBearing] = useState<number | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [viewingPhoto, setViewingPhoto] =
  useState<SavedPhoto | null>(null);
  const [photoCaption, setPhotoCaption] = useState("");
  const [editingCaptionPhotoId, setEditingCaptionPhotoId] =
  useState<number | null>(null);
  const [editingCaption, setEditingCaption] = useState("");

  const latitude = Number(latitudeText);
  const longitude = Number(longitudeText);

  const validCoordinates =
    latitudeText.trim() !== "" &&
    longitudeText.trim() !== "" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180;

  const createdDate = new Date(createdAt);
  const validDate =
    createdAt !== "" && !Number.isNaN(createdDate.getTime());

  const status =
    observationStatus === "reviewed" ? "Reviewed" : "Pending";

  const loadSavedPhotos = useCallback(async () => {
    if (!observationId || !apiUrl) {
      setPhotoError(
        !observationId
          ? "Observation ID is missing."
          : "The API URL is not configured."
      );
      return;
    }

    setLoadingPhotos(true);
    setPhotoError("");

    try {
      const token = await SecureStore.getItemAsync("access_token");

      console.log("Photo token available:", Boolean(token));
      console.log("Photo token length:", token?.length ?? 0);
      if (!token) {
        throw new Error("Please sign in again to view your photos.");
      }

      const response = await fetch(
        `${apiUrl}/observations/${observationId}/photos`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const result: PhotoResponse = await response.json();

      if (!response.ok) {
        throw new Error(
          result.detail ?? "Could not load saved photos."
        );
      }

      setPhotoToken(token);
      setSavedPhotos(result.photos ?? []);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not load saved photos.";

      setPhotoError(message);
      console.error("Load saved photos error:", error);
    } finally {
      setLoadingPhotos(false);
    }
  }, [observationId, apiUrl]);

  const savePhotoCaption = async (photo: SavedPhoto) => {
    try {
      const token = await SecureStore.getItemAsync("access_token");

      if (!token) {
        Alert.alert("Session expired", "Please sign in again.");
        return;
      }

      if (!apiUrl) {
        throw new Error("API URL is not configured.");
      }

      const response = await fetch(
        `${apiUrl}/observations/${photo.observation_id}/photos/${photo.id}/caption`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            caption: editingCaption.trim() || null,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Caption update failed (${response.status}).`);
      }

      const result = await response.json();

      setSavedPhotos((current) =>
        current.map((item) =>
          item.id === photo.id
            ? { ...item, caption: result.photo.caption }
            : item
        )
      );
      setEditingCaptionPhotoId(null);
      setEditingCaption("");
      Alert.alert("Success", "Photo caption updated.");
    } catch (error) {
      console.error("Save caption error:", error);
      Alert.alert(
        "Update failed",
        error instanceof Error ? error.message : "Please try again."
      );
    }
  };

  
const deletePhoto = (photo: SavedPhoto) => {
  Alert.alert(
    "Delete photo",
    "Are you sure you want to permanently delete this photo?",
    [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const token =
              await SecureStore.getItemAsync("access_token");

            if (!token) {
              Alert.alert(
                "Session expired",
                "Please sign in again."
              );
              return;
            }

            const apiUrl =
              process.env.EXPO_PUBLIC_API_URL;

            if (!apiUrl) {
              throw new Error(
                "API URL is not configured."
              );
            }

            const response = await fetch(
              `${apiUrl}/observations/${photo.observation_id}/photos/${photo.id}`,
              {
                method: "DELETE",
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              }
            );

            if (!response.ok) {
              const body = await response.text();

              throw new Error(
                `Delete failed (${response.status}): ${body}`
              );
            }

            setSavedPhotos((current) =>
              current.filter(
                (item) => item.id !== photo.id
              )
            );

            if (viewingPhoto?.id === photo.id) {
              setViewingPhoto(null);
            }

            Alert.alert(
              "Success",
              "Photo deleted successfully."
            );
          } catch (error) {
            console.error("Delete photo error:", error);

            Alert.alert(
              "Unable to delete photo",
              error instanceof Error
                ? error.message
                : "Please try again."
            );
          }
        },
      },
    ]
  );
};



  useEffect(() => {
    void loadSavedPhotos();
  }, [loadSavedPhotos]);

  const choosePhoto = async (useCamera: boolean) => {
    try {
      const permission = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permission required",
          useCamera
            ? "Allow camera access to take a photo."
            : "Allow photo-library access to choose a photo."
        );
        return;
      }

      const result = useCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            quality: 0.8,
          });

      if (!result.canceled && result.assets.length > 0) {
        uploadIdempotencyKey.current = null;
        setSelectedPhoto(result.assets[0]);
      }
    } catch (error) {
      console.error("Choose photo error:", error);
      Alert.alert(
        "Error",
        "Could not open the camera or photo gallery."
      );
    }
  };

  const uploadSelectedPhoto = async () => {
    if (!selectedPhoto) {
      Alert.alert("No photo selected", "Take or choose a photo first.");
      return;
    }

    if (!observationId || !apiUrl) {
      Alert.alert(
        "Configuration error",
        "The observation ID or API URL is missing."
      );
      return;
    }

          if (uploadLock.current || uploadingPhoto || !selectedPhoto) {
            return;
          }

          uploadLock.current = true;
          if (!uploadIdempotencyKey.current) {
            uploadIdempotencyKey.current = Crypto.randomUUID();
          }
          setUploadingPhoto(true);

    setUploadingPhoto(true);

    try {
      const token = await SecureStore.getItemAsync("access_token");

      if (!token) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const filename =
        selectedPhoto.fileName ??
        `observation-${observationId}-${Date.now()}.jpg`;

      const photoFile = new File(selectedPhoto.uri);
      const formData = new FormData();

      formData.append("file", photoFile, filename);
    //   formData.append("file", {
    //   uri: selectedPhoto.uri,
    //   name: selectedPhoto.fileName ?? "photo.jpg",
    //   type: selectedPhoto.mimeType ?? "image/jpeg",
    // } as any);
      formData.append("caption", photoCaption.trim());

      const response = await fetch(
        `${apiUrl}/observations/${observationId}/photos`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Idempotency-Key": uploadIdempotencyKey.current!,
          },
          body: formData,
        }
      );


              let result: {
                detail?: string;
                message?: string;
              } = {};

              try {
                result = await response.json();
              } catch {
                // The server may return an empty or non-JSON response.
              }

              if (!response.ok) {
                const message =
                  result.detail ??
                  result.message ??
                  (response.status === 401
                    ? "Your session has expired. Please sign in again."
                    : response.status === 413
                      ? "The photo is too large. Please choose a smaller image."
                      : response.status >= 500
                        ? "The server encountered a problem. Please try again later."
                        : `Photo upload failed (HTTP ${response.status}).`);

                throw new Error(message);
              }


            uploadIdempotencyKey.current = null;
            setSelectedPhoto(null);
            setPhotoCaption("");

      await loadSavedPhotos();

      Alert.alert("Success", "Photo uploaded successfully!");
    } catch (error) {
      console.error("Upload photo error:", error);

      let message = "Something went wrong. Please try again.";

        if (error instanceof Error) {
          if (
            error.message.includes("Network request failed") ||
            error.message.includes("Failed to fetch") ||
            error.message.includes("NetworkError")
          ) {
            message =
              "Could not connect to the server. Check your internet connection and make sure the GeoField API is running.";
          } else {
            message = error.message;
          }
        }

  Alert.alert("Upload failed", message);
    } finally {
      uploadLock.current = false;
      setUploadingPhoto(false);
    }
  };

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

      const position = await Location.getCurrentPositionAsync({
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
        {projectName || "Field Project"}
      </Text>

      {/* Photo capture and upload */}
      <View style={styles.photoSection}>
        <Text style={styles.sectionHeading}>
          Observation Photos
        </Text>

        <View style={styles.photoButtonRow}>
          <Pressable
            onPress={() => void choosePhoto(true)}
            style={styles.cameraButton}
          >
            <Text style={styles.buttonText}>Take a Photo</Text>
          </Pressable>

          <Pressable
            onPress={() => void choosePhoto(false)}
            style={styles.galleryButton}
          >
            <Text style={styles.buttonText}>Choose from Gallery</Text>
          </Pressable>
        </View>

        {selectedPhoto && (
          // <View style={styles.photoCard}>
          <View style={styles.selectedPhotoCard}>
            <Text style={styles.photoHeading}>
              Selected Photo Preview
            </Text>

            <Image
              source={{ uri: selectedPhoto.uri }}
              style={styles.photoImage}
              resizeMode="cover"
            />

            <Text style={styles.photoMetadata}>
              {selectedPhoto.fileName ?? "Selected image"}
            </Text>

            <Text style={styles.sectionHeading}>Photo Caption</Text>
            <TextInput
              value={photoCaption}
              onChangeText={setPhotoCaption}
              placeholder="Describe what this photo shows..."
              maxLength={255}
              multiline
              style={styles.captionInput}
            />
            <Text style={styles.captionCounter}>
              {photoCaption.length}/255
            </Text>

            <Pressable
              onPress={uploadSelectedPhoto}
              disabled={uploadingPhoto || !selectedPhoto}
              accessibilityRole="button"
              accessibilityLabel={
              uploadingPhoto ? "Uploading photo" : "Upload selected photo"
                }
                accessibilityState={{
                disabled: uploadingPhoto || !selectedPhoto,
                busy: uploadingPhoto,
                 }}
              style={[
                styles.uploadButton,
                (uploadingPhoto || !selectedPhoto) &&
                  styles.disabledButton,
              ]}
            >
              <Text style={styles.uploadButtonText}>
                {uploadingPhoto ? "Uploading..." : "Upload Photo"}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setSelectedPhoto(null)}
              disabled={uploadingPhoto}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelButtonText}>
                Cancel Selection
              </Text>
            </Pressable>
          </View>
        )}

        <View style={styles.savedPhotosHeader}>
          <Text style={styles.sectionHeading}>
          {/* <Text style={styles.sectionTitle}> */}
            Saved Photos ({savedPhotos.length})
          </Text>

          <Pressable onPress={() => void loadSavedPhotos()}>
            <Text style={styles.refreshText}>Refresh</Text>
          </Pressable>
        </View>

          {loadingPhotos && (
            <View style={styles.photoLoading}>
              <ActivityIndicator size="large" color="#2563EB" />
              <Text style={styles.photoLoadingText}>
                Loading your photos...
              </Text>
            </View>
          )}

        {!!photoError && (
          <View>
            <Text style={styles.errorText}>{photoError}</Text>

            <Pressable onPress={() => void loadSavedPhotos()}>
              <Text style={styles.refreshText}>Try Again</Text>
            </Pressable>
          </View>
        )}

            {!loadingPhotos &&
              !photoError &&
              savedPhotos.length === 0 && (
                <View style={styles.emptyPhotoState}>
                  <Text style={styles.emptyPhotoIcon}>📷</Text>

                  <Text style={styles.emptyPhotoTitle}>
                    No photos yet
                  </Text>

                  <Text style={styles.emptyPhotoMessage}>
                    Add photos to document this observation and keep
                    visual evidence of your fieldwork.
                  </Text>
                </View>
              )}

          <View style={styles.photoGallery}>
        {savedPhotos.map((photo) => (
          <View key={photo.id} style={styles.photoCard}>
            <Text style={styles.photoHeading}>
              Photo #{photo.id}
            </Text>

            <Pressable
              onPress={() => setViewingPhoto(photo)}
              accessibilityRole="button"
              accessibilityLabel={`View photo: ${photo.caption?.trim() || `Photo ${photo.id}`}`}
              accessibilityHint="Opens this photo in the full-screen viewer"
            >
            <Image
              source={{
                uri: `${apiUrl}/observations/${photo.observation_id}/photos/${photo.id}/image`,
                headers: {
                  Authorization: `Bearer ${photoToken}`,
                },
              }}
            style={styles.photoImage}
              contentFit="cover"
              accessibilityLabel={photo.caption?.trim() || "Observation photo"}
              onLoad={() => {
                setFailedPhotoIds((previous) =>
                  previous.filter((id) => id !== photo.id)
                );
              }}
              onError={() => {
                setFailedPhotoIds((previous) =>
                  previous.includes(photo.id)
                    ? previous
                    : [...previous, photo.id]
                );
              }}
            />
            </Pressable>
            {failedPhotoIds.includes(photo.id) && (
            <View style={styles.photoImageError}>
              <Text style={styles.photoImageErrorTitle}>
                Photo unavailable
              </Text>
              <Text style={styles.photoImageErrorMessage}>
                This image could not be loaded. Try refreshing the gallery.
              </Text>
            </View>
          )}

            {editingCaptionPhotoId === photo.id ? (
              <View style={styles.captionEditor}>
                <TextInput
                  value={editingCaption}
                  onChangeText={setEditingCaption}
                  placeholder="Enter photo caption..."
                  maxLength={255}
                  multiline
                  style={styles.captionInput}
                />

                <View style={styles.captionActions}>
                  <Pressable
                    onPress={() => void savePhotoCaption(photo)}
                    style={styles.saveCaptionButton}
                  >
                    <Text style={styles.saveCaptionText}>Save</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      setEditingCaptionPhotoId(null);
                      setEditingCaption("");
                    }}
                    style={styles.cancelCaptionButton}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel photo"
                  >
                    <Text style={styles.cancelCaptionText}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View>
                <Text style={styles.photoCaption}>
                  {photo.caption || "No caption"}
                </Text>

                <Pressable
                  onPress={() => {
                    setEditingCaptionPhotoId(photo.id);
                    setEditingCaption(photo.caption ?? "");
                  }}
                  style={styles.editCaptionButton}
                >
                  <Text style={styles.editCaptionText}>Edit caption</Text>
                </Pressable>
              </View>
            )}

             <Pressable
              onPress={() => deletePhoto(photo)}
              style={styles.deletePhotoButton}
              accessibilityRole="button"
              accessibilityLabel="Delete photo"
            >
              <Text style={styles.deletePhotoText}>
                Delete photo
              </Text>
            </Pressable>



            <Text style={styles.photoMetadata}>
              {photo.filename}
            </Text>

            <Text style={styles.photoMetadata}>
              Uploaded:{" "}
              {new Date(photo.created_at).toLocaleString()}
            </Text>
            </View>
              ))}
            </View>
            </View>

      {/* Observation information */}
      <View style={styles.card}>
        <Text style={styles.label}>Observation title</Text>
        <Text style={styles.title}>{title || "Untitled"}</Text>

        <Text style={styles.label}>Notes</Text>
        <Text style={styles.notes}>
          {notes.trim() || "No notes provided."}
        </Text>

        <Text style={styles.label}>Review status</Text>

        <View
          style={[
            styles.badge,
            observationStatus === "reviewed"
              ? styles.reviewed
              : styles.pending,
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              observationStatus === "reviewed"
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
          {observationId || "Unavailable"}
        </Text>

        <Text style={styles.label}>Date recorded</Text>
        <Text style={styles.coordinate}>
          {validDate
            ? createdDate.toLocaleString()
            : "Unavailable"}
        </Text>
      </View>

      {/* GPS distance and navigation */}
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
              projectId,
              projectName: projectName || "Field Project",
              observationId,
            },
          })
        }
      >
        <Text style={styles.buttonText}>
          View Project Observations on Map
        </Text>
      </Pressable>

      <Modal
        visible={viewingPhoto !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setViewingPhoto(null)}
      >
        <View style={styles.photoViewer}>
          <Pressable
            style={styles.closeViewerButton}
            onPress={() => setViewingPhoto(null)}
            accessibilityRole="button"
            accessibilityLabel="Close photo viewer"
          >
            {/* <Text style={styles.closeViewerText}>✕</Text> */}
            <Text style={styles.closeViewerText}>{"\u2715"}</Text>
          </Pressable>

            {viewingPhoto && (
              <>
                <Image
                  source={{
                    uri: `${apiUrl}/observations/${viewingPhoto.observation_id}/photos/${viewingPhoto.id}/image`,
                    headers: {
                      Authorization: `Bearer ${photoToken}`,
                    },
                  }}
                  style={styles.fullScreenPhoto}
                  contentFit="contain"
                />

                <Text style={styles.viewerCaption}>
                  {viewingPhoto.caption?.trim() || "No caption"}
                </Text>
              </>
            )}
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingTop: 32,
    paddingBottom: 48,
    flexGrow: 1,
    backgroundColor: "#f5f7f3",
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
  },
  back: {
    color: "#205a46",
    fontWeight: "600",
    marginBottom: 20,
  },
  heading: {
    fontSize: 27,
    fontWeight: "800",
    color: "#18352c",
  },
  subtitle: {
    color: "#718078",
    marginTop: 6,
    marginBottom: 20,
  },
  photoSection: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 16,
    marginBottom: 18,
    gap: 12,
  },
  sectionHeading: {
    fontSize: 19,
    fontWeight: "800",
    color: "#0F172A",
  },
  photoButtonRow: {
    gap: 10,
  },
  cameraButton: {
    backgroundColor: "#205a46",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  galleryButton: {
    backgroundColor: "#15803D",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  uploadButton: {
    backgroundColor: "#7C3AED",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 8,
  },
  cancelButton: {
    alignItems: "center",
    padding: 10,
  },
  cancelButtonText: {
    color: "#DC2626",
    fontWeight: "600",
  },
  savedPhotosHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  refreshText: {
    color: "#2563EB",
    fontWeight: "700",
  },
    photoCard: {
      width: "48%",
      borderWidth: 1,
      borderColor: "#E2E8F0",
      borderRadius: 14,
      padding: 8,
      backgroundColor: "#FFFFFF",
      gap: 6,
      marginBottom: 4,
    },
    selectedPhotoCard: {
        width: "100%",
        borderWidth: 1,
        borderColor: "#E2E8F0",
        borderRadius: 14,
        padding: 12,
        backgroundColor: "#FFFFFF",
        gap: 8,
      },
      photoHeading: {
        fontSize: 13,
        fontWeight: "700",
        color: "#0F172A",
      },
  photoImage: {
    width: "100%",
    height: 140,
    borderRadius: 8,
    backgroundColor: "#E5E7EB",
  },
  photoMetadata: {
    color: "#64748B",
    fontSize: 12,
    lineHeight: 18,
  },
  errorText: {
    color: "#DC2626",
    marginVertical: 6,
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
  photoViewer: {
  flex: 1,
  backgroundColor: "#000000",
  justifyContent: "center",
  alignItems: "center",
  paddingHorizontal: 12,
},

closeViewerButton: {
  position: "absolute",
  top: 50,
  right: 20,
  zIndex: 10,
  width: 46,
  height: 46,
  borderRadius: 23,
  backgroundColor: "rgba(255, 255, 255, 0.18)",
  justifyContent: "center",
  alignItems: "center",
  borderWidth: 1,
  borderColor: "rgba(255, 255, 255, 0.3)",
},

closeViewerText: {
  color: "#FFFFFF",
  fontSize: 24,
  fontWeight: "bold",
  textAlign: "center",
},

fullScreenPhoto: {
  width: "100%",
  height: "80%",
},
viewerCaption: {
  color: "#FFFFFF",
  fontSize: 15,
  lineHeight: 22,
  textAlign: "center",
  paddingHorizontal: 16,
  paddingTop: 12,
  paddingBottom: 20,
},
deletePhotoButton: {
  marginTop: 8,
  paddingVertical: 10,
  paddingHorizontal: 14,
  borderRadius: 8,
  backgroundColor: "#FEE2E2",
  alignSelf: "flex-start",
},

deletePhotoText: {
  color: "#B91C1C",
  fontWeight: "600",
},
uploadButtonText: {
  color: "#FFFFFF",
  fontSize: 15,
  fontWeight: "700",
  textAlign: "center",
},
  captionInput: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    padding: 12,
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: 4,
  },
  captionCounter: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "right",
    marginBottom: 12,
  },
  photoCaption: {
    marginTop: 8,
    fontSize: 14,
    color: "#374151",
  },
  captionEditor: {
    marginTop: 8,
  },
  captionActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  editCaptionButton: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: "#DBEAFE",
  },
  editCaptionText: {
    color: "#1D4ED8",
    fontWeight: "600",
  },
  saveCaptionButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: "#166534",
  },
  saveCaptionText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  cancelCaptionButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  cancelCaptionText: {
    color: "#6B7280",
    fontWeight: "600",
  },
  photoGallery: {
  flexDirection: "row",
  flexWrap: "wrap",
  justifyContent: "space-between",
  gap: 12,
  marginTop: 12,
},
photoLoading: {
  alignItems: "center",
  justifyContent: "center",
  paddingVertical: 28,
  gap: 10,
},

photoLoadingText: {
  fontSize: 14,
  color: "#64748B",
},

emptyPhotoState: {
  alignItems: "center",
  justifyContent: "center",
  paddingVertical: 28,
  paddingHorizontal: 20,
  marginTop: 12,
  borderWidth: 1,
  borderColor: "#E2E8F0",
  borderStyle: "dashed",
  borderRadius: 14,
  backgroundColor: "#FFFFFF",
},

emptyPhotoIcon: {
  fontSize: 36,
  marginBottom: 10,
},
emptyPhotoTitle: {
  fontSize: 16,
  fontWeight: "700",
  color: "#0F172A",
  marginBottom: 6,
},
emptyPhotoMessage: {
  fontSize: 13,
  lineHeight: 20,
  color: "#64748B",
  textAlign: "center",
},
photoImageError: {
  alignItems: "center",
  justifyContent: "center",
  padding: 12,
  backgroundColor: "#FEF2F2",
  borderRadius: 8,
  marginTop: 6,
},
photoImageErrorTitle: {
  fontSize: 13,
  fontWeight: "700",
  color: "#B91C1C",
  marginBottom: 4,
},
photoImageErrorMessage: {
  fontSize: 12,
  color: "#7F1D1D",
  textAlign: "center",
  lineHeight: 18,
},
});
