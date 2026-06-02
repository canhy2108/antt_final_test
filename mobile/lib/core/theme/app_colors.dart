import 'package:flutter/material.dart';

/// BudgetBee Design System — Color Tokens
/// Extracted from: lime-green + black + cream style reference
abstract class AppColors {
  // ── Brand ─────────────────────────────────────────────────────────────────
  /// Primary lime-green — main accent, CTAs, active states
  static const primary = Color(0xFFBDE83E);
  static const primaryLight = Color(0xFFD4F26A);
  static const primaryDark = Color(0xFF9ACF1A);

  /// Gradient for main card (top to bottom)
  static const gradientStart = Color(0xFFBDE83E);
  static const gradientEnd = Color(0xFF6DB33F);

  // ── Neutrals ──────────────────────────────────────────────────────────────
  static const black = Color(0xFF111111);
  static const dark = Color(0xFF1C1C1E);
  static const grey900 = Color(0xFF212121);
  static const grey800 = Color(0xFF424242);
  static const grey600 = Color(0xFF757575);
  static const grey400 = Color(0xFFBDBDBD);
  static const grey200 = Color(0xFFEEEEEE);
  static const grey100 = Color(0xFFF5F5F5);
  static const white = Color(0xFFFFFFFF);

  // ── Background ────────────────────────────────────────────────────────────
  static const background = Color(0xFFF2F2F4);
  static const surface = Color(0xFFFFFFFF);
  static const surfaceDark = Color(0xFF1C1C1E);

  // ── Semantic ──────────────────────────────────────────────────────────────
  static const income = Color(0xFF22C55E);   // positive transactions
  static const expense = Color(0xFFEF4444);  // negative transactions
  static const warning = Color(0xFFF59E0B);
  static const info = Color(0xFF3B82F6);

  // ── Dark Mode ─────────────────────────────────────────────────────────────
  static const darkBackground = Color(0xFF0A0A0A);
  static const darkSurface = Color(0xFF1C1C1E);
  static const darkSurface2 = Color(0xFF2C2C2E);

  // ── Text ──────────────────────────────────────────────────────────────────
  static const textPrimary = Color(0xFF111111);
  static const textSecondary = Color(0xFF8E8E93);
  static const textDisabled = Color(0xFFBDBDBD);
  static const textOnPrimary = Color(0xFF111111); // black on lime
  static const textOnDark = Color(0xFFFFFFFF);

  // ── Overlay & Blur ────────────────────────────────────────────────────────
  static const overlayDark = Color(0x80000000);
  static const overlayLight = Color(0x33FFFFFF);

  // ── Border ────────────────────────────────────────────────────────────────
  static const border = Color(0xFFE5E7EB);
  static const borderFocus = Color(0xFFBDE83E);
}
