import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { COLORS, FONTS, SPACING, RADIUS } from '../../lib/constants';
import type { GroupRecord } from '../../lib/types';

interface HistoryCardProps {
  group: GroupRecord;
  onViewDetails: () => void;
  onDelete: () => void;
  onAskAI: () => void;
  onExportPDF: () => void;
}

export function HistoryCard({
  group,
  onViewDetails,
  onDelete,
  onAskAI,
  onExportPDF,
}: HistoryCardProps) {
  const statusColors = {
    completed: COLORS.success,
    processing: COLORS.primary,
    partial: COLORS.warning,
    failed: COLORS.error,
  };

  const statusColor = statusColors[group.status as keyof typeof statusColors] || COLORS.textMuted;

  const handleDelete = () => {
    Alert.alert(
      'Delete Group',
      'Are you sure you want to delete this analysis? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
      ]
    );
  };

  // Use imageCount from backend, presignedViewUrls only available in detail view
  const imageCount = group.imageCount || 0;
  const fishCount = group.analysisResult?.aggregateStats?.totalFishCount || 0;
  const speciesCount = group.analysisResult?.aggregateStats?.speciesDistribution
    ? Object.keys(group.analysisResult.aggregateStats.speciesDistribution).length
    : 0;
  const hasDiseases = group.analysisResult?.detections?.some(d => d.diseaseStatus !== 'Healthy') || false;

  // Show thumbnails only if presignedViewUrls are available (from detail view)
  const hasImages = group.presignedViewUrls && group.presignedViewUrls.length > 0;

  return (
    <View style={styles.card}>
      {/* Thumbnail Grid or Placeholder */}
      {hasImages ? (
        <View style={styles.thumbnailGrid}>
          {group.presignedViewUrls!.slice(0, 4).map((url, index) => (
            <Image
              key={index}
              source={{ uri: url }}
              style={styles.thumbnail}
              resizeMode="cover"
            />
          ))}
          {imageCount > 4 && (
            <View style={styles.moreOverlay}>
              <Text style={styles.moreText}>+{imageCount - 4}</Text>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.placeholderGrid}>
          <View style={styles.placeholderIcon}>
            <Ionicons name="images-outline" size={32} color={COLORS.textMuted} />
            <Text style={styles.placeholderText}>{imageCount} images</Text>
          </View>
        </View>
      )}

      {/* Info Section */}
      <View style={styles.infoSection}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <View style={styles.row}>
              <View style={styles.imageCountContainer}>
                <Ionicons name="images" size={14} color={COLORS.textSecondary} />
                <Text style={styles.imageCount}>{imageCount} images</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                <Text style={[styles.statusText, { color: statusColor }]}>
                  {group.status}
                </Text>
              </View>
            </View>
            <Text style={styles.date}>
              {new Date(group.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        </View>

        {/* Stats */}
        {group.status === 'completed' && (
          <View style={styles.stats}>
            <View style={styles.statItem}>
              <Ionicons name="fish" size={20} color={COLORS.primary} />
              <Text style={styles.statValue}>{fishCount}</Text>
              <Text style={styles.statLabel}>Fish</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="list" size={20} color={COLORS.secondary} />
              <Text style={styles.statValue}>{speciesCount}</Text>
              <Text style={styles.statLabel}>Species</Text>
            </View>
            {hasDiseases && (
              <View style={styles.statItem}>
                <Ionicons name="warning" size={20} color={COLORS.error} />
                <Text style={[styles.statValue, { color: COLORS.error }]}>!</Text>
                <Text style={styles.statLabel}>Disease</Text>
              </View>
            )}
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={onViewDetails}>
            <Ionicons name="eye-outline" size={18} color={COLORS.primaryLight} />
            <Text style={styles.actionText}>View</Text>
          </TouchableOpacity>
          
          {group.status === 'completed' && (
            <>
              <TouchableOpacity style={styles.actionBtn} onPress={onAskAI}>
                <Ionicons name="chatbubble-outline" size={18} color={COLORS.primaryLight} />
                <Text style={styles.actionText}>Ask AI</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.actionBtn} onPress={onExportPDF}>
                <Ionicons name="document-outline" size={18} color={COLORS.primaryLight} />
                <Text style={styles.actionText}>PDF</Text>
              </TouchableOpacity>
            </>
          )}
          
          <TouchableOpacity style={styles.actionBtn} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={18} color={COLORS.error} />
            <Text style={[styles.actionText, { color: COLORS.error }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.bgCard,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  thumbnailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    height: 120,
  },
  thumbnail: {
    width: '50%',
    height: '50%',
    borderWidth: 0.5,
    borderColor: COLORS.border,
  },
  moreOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: '50%',
    height: '50%',
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreText: {
    color: COLORS.textPrimary,
    fontSize: FONTS.sizes.lg,
    fontWeight: FONTS.weights.bold,
  },
  placeholderGrid: {
    height: 120,
    backgroundColor: COLORS.bgSurface,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  placeholderIcon: {
    alignItems: 'center',
    gap: SPACING.xs,
  },
  placeholderText: {
    fontSize: FONTS.sizes.sm,
    color: COLORS.textMuted,
    fontWeight: FONTS.weights.semibold,
  },
  infoSection: {
    padding: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  imageCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  imageCount: {
    fontSize: FONTS.sizes.sm,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.textSecondary,
  },
  statusBadge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
    textTransform: 'capitalize',
  },
  date: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
  },
  stats: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.bold,
    color: COLORS.textPrimary,
    marginTop: 2,
  },
  statLabel: {
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: COLORS.bgSurface,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.semibold,
    color: COLORS.primaryLight,
  },
});
