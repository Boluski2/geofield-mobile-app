import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { apiRequest } from "../lib/api";

export default function RegisterScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function register() {
    if (!name.trim() || !email.trim() || password.length < 8) {
      Alert.alert(
        "Check your details",
        "Enter your name, email, and a password of at least 8 characters."
      );
      return;
    }

    setLoading(true);

    try {
      await apiRequest("/register", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      Alert.alert(
        "Account created",
        "Your account is ready. Return to the login screen."
      );
      setPassword("");
    } catch (error) {
      Alert.alert(
        "Registration failed",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.brandMark}><Text style={styles.brandMarkText}>G</Text></View>
          <View>
            <Text style={styles.brand}>GeoField</Text>
            <Text style={styles.brandCaption}>FIELDWORK, ORGANIZED</Text>
          </View>
        </View>

        <View style={styles.intro}>
          <Text style={styles.eyebrow}>GET STARTED</Text>
          <Text style={styles.title}>Make room for better fieldwork.</Text>
          <Text style={styles.subtitle}>
            Create an account to organize your projects and field data.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Create your account</Text>
          <Text style={styles.cardSubtitle}>A few details and you’re ready to go.</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Full name</Text>
            <TextInput
              style={styles.input}
              placeholder="Your name"
              placeholderTextColor="#98a4b5"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoComplete="name"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Email address</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor="#98a4b5"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              placeholder="At least 8 characters"
              placeholderTextColor="#98a4b5"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="new-password"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={showPassword ? "Hide password" : "Show password"}
              accessibilityState={{ selected: showPassword }}
              hitSlop={8}
              onPress={() => setShowPassword((visible) => !visible)}
              style={styles.passwordToggle}
            >
              <Text style={styles.passwordToggleText}>{showPassword ? "Hide" : "Show"}</Text>
            </Pressable>
            <Text style={styles.helper}>Use at least 8 characters.</Text>
          </View>

          <Pressable
            style={[styles.button, loading && styles.disabled]}
            onPress={register}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Create account</Text>
            )}
          </Pressable>

          <View style={styles.signInRow}>
            <Text style={styles.signInPrompt}>Already have an account?</Text>
            <Pressable onPress={() => router.replace("/")} hitSlop={8}>
              <Text style={styles.signInLink}>Sign in</Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.footer}>Your projects and field data, all in one place.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f7f4",
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginBottom: 32,
  },
  brandMark: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#173f35",
  },
  brandMarkText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
  },
  brand: {
    color: "#173f35",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  brandCaption: {
    color: "#718078",
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.4,
    marginTop: 2,
  },
  intro: {
    marginBottom: 22,
  },
  eyebrow: {
    color: "#4d806b",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  title: {
    color: "#172620",
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  subtitle: {
    color: "#6f7d76",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 24,
    borderWidth: 1,
    borderColor: "#e9eeea",
    shadowColor: "#173f35",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 24,
    elevation: 3,
  },
  cardTitle: {
    color: "#172620",
    fontSize: 21,
    fontWeight: "700",
  },
  cardSubtitle: {
    color: "#7a877f",
    fontSize: 13,
    marginTop: 5,
    marginBottom: 20,
  },
  field: {
    gap: 8,
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#35463e",
  },
  input: {
    borderWidth: 1,
    borderColor: "#dce5df",
    backgroundColor: "#fbfcfb",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: "#172620",
  },
  passwordInput: { paddingRight: 66 },
  passwordToggle: { position: "absolute", right: 14, top: 39, minHeight: 34, justifyContent: "center", paddingHorizontal: 4 },
  passwordToggleText: { color: "#205a46", fontSize: 13, fontWeight: "700" },
  helper: {
    color: "#8a968f",
    fontSize: 12,
  },
  button: {
    backgroundColor: "#1d5947",
    minHeight: 54,
    padding: 15,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  disabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  signInRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
    marginTop: 22,
  },
  signInPrompt: {
    color: "#7a877f",
    fontSize: 13,
  },
  signInLink: {
    color: "#1d5947",
    fontWeight: "700",
    fontSize: 13,
  },
  footer: {
    color: "#96a29a",
    fontSize: 12,
    textAlign: "center",
    marginTop: 24,
  },
});
