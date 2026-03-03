import React, { useState } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { toastService } from "../../lib/toast-service";
import { Avatar } from "../ui/Avatar";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { AvatarService } from "../../lib/avatar-service";
import { COLORS, SPACING, FONTS } from "../../lib/constants";

interface AvatarUploaderProps {
  currentUri?: string;
  userName?: string;
  onUploadComplete: (uri: string) => void;
  onUploadError: (error: Error) => void;
}

export function AvatarUploader({
  currentUri,
  userName = "User",
  onUploadComplete,
  onUploadError,
}: AvatarUploaderProps) {
  const [showModal, setShowModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const handleAvatarPress = () => {
    setShowModal(true);
  };

  const handlePickImage = async (source: "camera" | "library") => {
    try {
      setShowModal(false);
      const imageUri = await AvatarService.pickImage(source);
      if (imageUri) {
        setPreviewUri(imageUri);
        setShowModal(true);
      }
    } catch (error) {
      if (error instanceof Error && error.message === "Permission denied") {
        toastService.error(
          `${source === "camera" ? "Camera" : "Photo library"} permission is required.`,
        );
      } else {
        onUploadError(error as Error);
      }
    }
  };

  const handleUpload = async () => {
    if (!previewUri) return;

    try {
      setUploading(true);
      setUploadProgress(0);

      const avatarUrl = await AvatarService.uploadAvatar(
        previewUri,
        (progress) => setUploadProgress(progress),
      );

      setUploading(false);
      setPreviewUri(null);
      setShowModal(false);
      onUploadComplete(avatarUrl);
      toastService.success("Profile photo updated successfully!");
    } catch (error) {
      setUploading(false);
      toastService.error("Failed to upload profile photo. Please try again.");
      onUploadError(error as Error);
      setPreviewUri(null);
      setShowModal(false);
    }
  };

  const handleCancel = () => {
    setPreviewUri(null);
    setShowModal(false);
    setUploadProgress(0);
  };

  return (
    <>
      <Avatar
        uri={currentUri}
        name={userName}
        size="xl"
        editable
        onPress={handleAvatarPress}
        loading={uploading}
      />

      <Modal
        visible={showModal}
        onClose={handleCancel}
        title={previewUri ? "Preview" : "Choose Photo"}
        size="sm"
      >
        {previewUri ? (
          <View style={styles.previewContainer}>
            <Avatar uri={previewUri} name={userName} size="xl" />

            {uploading && (
              <View style={styles.progressContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.progressText}>
                  Uploading... {uploadProgress}%
                </Text>
              </View>
            )}

            <View style={styles.buttonContainer}>
              <Button
                label="Cancel"
                onPress={handleCancel}
                variant="outline"
                disabled={uploading}
                style={styles.button}
              />
              <Button
                label="Upload"
                onPress={handleUpload}
                disabled={uploading}
                style={styles.button}
              />
            </View>
          </View>
        ) : (
          <View style={styles.optionsContainer}>
            <Text style={styles.optionsTitle}>Choose Photo Source</Text>
            <Button
              label="Take Photo"
              onPress={() => handlePickImage("camera")}
              variant="primary"
              icon={<Ionicons name="camera" size={20} color="#fff" />}
              iconPosition="left"
              style={styles.optionButton}
              fullWidth
            />
            <Button
              label="Choose from Gallery"
              onPress={() => handlePickImage("library")}
              variant="outline"
              icon={
                <Ionicons name="images" size={20} color={COLORS.primaryLight} />
              }
              iconPosition="left"
              style={styles.optionButton}
              fullWidth
            />
          </View>
        )}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  previewContainer: {
    alignItems: "center",
  },
  progressContainer: {
    marginTop: SPACING.lg,
    alignItems: "center",
  },
  progressText: {
    marginTop: SPACING.sm,
    fontSize: FONTS.sizes.sm,
    color: COLORS.textSecondary,
  },
  buttonContainer: {
    flexDirection: "row",
    marginTop: SPACING.xl,
    gap: SPACING.md,
    width: "100%",
  },
  button: {
    flex: 1,
  },
  optionsContainer: {
    gap: SPACING.md,
    paddingVertical: SPACING.md,
  },
  optionsTitle: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  optionButton: {
    width: "100%",
    minHeight: 56,
  },
});
