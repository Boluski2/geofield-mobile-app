import { useState } from "react";
import {
  Alert,
  Button,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiRequest } from "../lib/api";

export default function RegisterScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    <SafeAreaView style={{ flex: 1, padding: 24, gap: 16 }}>
      <TextInput
        placeholder="Full name"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
      />
      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        placeholder="Password (minimum 8 characters)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Button
        title={loading ? "Creating account..." : "Register"}
        onPress={register}
        disabled={loading}
      />
    </SafeAreaView>
  );
}