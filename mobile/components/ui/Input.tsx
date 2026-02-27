import React from 'react';
import { View, TextInput, Text, StyleSheet, TextInputProps, ViewStyle } from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS } from '../../lib/constants';

interface InputProps extends TextInputProps {
    label?: string;
    error?: string;
    containerStyle?: ViewStyle;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

export function Input({
    label,
    error,
    containerStyle,
    leftIcon,
    rightIcon,
    style,
    ...rest
}: InputProps) {
    return (
        <View style={[styles.container, containerStyle]}>
            {label && <Text style={styles.label}>{label}</Text>}
            <View style={[styles.inputRow, error ? styles.inputError : null]}>
                {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
                <TextInput
                    placeholderTextColor={COLORS.textSubtle}
                    style={[styles.input, leftIcon ? styles.inputWithLeftIcon : null, style]}
                    {...rest}
                />
                {rightIcon && <View style={styles.rightIcon}>{rightIcon}</View>}
            </View>
            {error && <Text style={styles.error}>{error}</Text>}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { gap: SPACING.sm },
    label: {
        fontSize: FONTS.sizes.sm,
        fontWeight: FONTS.weights.semibold,
        color: COLORS.textSecondary,
        letterSpacing: 0.3,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.bgSurface,
        borderRadius: RADIUS.lg,
        borderWidth: 1.5,
        borderColor: COLORS.border,
        minHeight: 52,
    },
    inputError: { borderColor: COLORS.error },
    input: {
        flex: 1,
        paddingHorizontal: SPACING.base,
        paddingVertical: SPACING.md,
        color: COLORS.textPrimary,
        fontSize: FONTS.sizes.base,
    },
    inputWithLeftIcon: { paddingLeft: SPACING.sm },
    leftIcon: { paddingLeft: SPACING.base },
    rightIcon: { paddingRight: SPACING.base },
    error: {
        fontSize: FONTS.sizes.sm,
        color: COLORS.error,
    },
});
