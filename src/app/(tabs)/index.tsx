
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import { router } from "expo-router";
import { apiRequest, ApiError } from "../../lib/api";

export default function HomeScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function login() {
    if (!email.trim() || !password) {
      Alert.alert("Missing details", "Enter your email and password.");
      return;
    }

    setLoading(true);

    try {
      // Day 7 uses OAuth2PasswordRequestForm.
      // It expects form data, not JSON.
      const data = await apiRequest<{ access_token: string }>("/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          username: email.trim().toLowerCase(),
          password,
        }).toString(),
      });
      const accessToken: string = data.access_token;

      // Store the token securely on native devices.
      await SecureStore.setItemAsync("access_token", accessToken);

      // Request the protected profile.
      await apiRequest("/me", {}, accessToken);

      setPassword("");
      router.navigate("/dashboard");
    } catch (error) {
      Alert.alert(
        "Connection or login error",
        error instanceof ApiError && error.status === 401
          ? "Incorrect email or password."
          : error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.brand}>GeoField</Text>
        <Text style={styles.subtitle}>
          Your mobile field-data workspace
        </Text>

        <Text style={styles.heading}>Sign in</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="you@example.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
        />

        <Pressable
          style={[styles.button, loading && styles.disabled]}
          onPress={login}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign in</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "#f3f6fb",
    padding: 24,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    gap: 12,
  },
  brand: {
    color: "#2457d6",
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    color: "#64748b",
    marginBottom: 16,
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    color: "#172033",
    marginBottom: 8,
  },
  label: {
    fontWeight: "600",
    color: "#334155",
  },
  input: {
    borderWidth: 1,
    borderColor: "#d8e0ec",
    borderRadius: 10,
    padding: 13,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#2457d6",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 12,
  },
  disabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
});
