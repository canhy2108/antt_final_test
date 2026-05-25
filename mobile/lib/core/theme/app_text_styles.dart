import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'app_colors.dart';

abstract class AppTextStyles {
  // ── Display (big money amounts) ─────────────────────────────────────────
  static TextStyle get displayXL => GoogleFonts.inter(
        fontSize: 40,
        fontWeight: FontWeight.w800,
        color: AppColors.textPrimary,
        letterSpacing: -1.0,
      );

  static TextStyle get displayL => GoogleFonts.inter(
        fontSize: 32,
        fontWeight: FontWeight.w800,
        color: AppColors.textPrimary,
        letterSpacing: -0.8,
      );

  static TextStyle get displayM => GoogleFonts.inter(
        fontSize: 28,
        fontWeight: FontWeight.w700,
        color: AppColors.textPrimary,
        letterSpacing: -0.5,
      );

  // ── Money (monospace-style for amounts) ─────────────────────────────────
  static TextStyle get moneyXL => GoogleFonts.inter(
        fontSize: 36,
        fontWeight: FontWeight.w800,
        color: AppColors.white,
        letterSpacing: -1.0,
        fontFeatures: const [FontFeature.tabularFigures()],
      );

  static TextStyle get moneyL => GoogleFonts.inter(
        fontSize: 28,
        fontWeight: FontWeight.w700,
        color: AppColors.textPrimary,
        fontFeatures: const [FontFeature.tabularFigures()],
      );

  static TextStyle get moneyM => GoogleFonts.inter(
        fontSize: 20,
        fontWeight: FontWeight.w600,
        color: AppColors.textPrimary,
        fontFeatures: const [FontFeature.tabularFigures()],
      );

  static TextStyle get moneyS => GoogleFonts.inter(
        fontSize: 16,
        fontWeight: FontWeight.w600,
        color: AppColors.textPrimary,
        fontFeatures: const [FontFeature.tabularFigures()],
      );

  // ── Headings ────────────────────────────────────────────────────────────
  static TextStyle get headingXL => GoogleFonts.inter(
        fontSize: 24,
        fontWeight: FontWeight.w700,
        color: AppColors.textPrimary,
      );

  static TextStyle get headingL => GoogleFonts.inter(
        fontSize: 20,
        fontWeight: FontWeight.w700,
        color: AppColors.textPrimary,
      );

  static TextStyle get headingM => GoogleFonts.inter(
        fontSize: 18,
        fontWeight: FontWeight.w600,
        color: AppColors.textPrimary,
      );

  static TextStyle get headingS => GoogleFonts.inter(
        fontSize: 16,
        fontWeight: FontWeight.w600,
        color: AppColors.textPrimary,
      );

  // ── Body ─────────────────────────────────────────────────────────────────
  static TextStyle get bodyL => GoogleFonts.inter(
        fontSize: 16,
        fontWeight: FontWeight.w400,
        color: AppColors.textPrimary,
        height: 1.5,
      );

  static TextStyle get bodyM => GoogleFonts.inter(
        fontSize: 14,
        fontWeight: FontWeight.w400,
        color: AppColors.textPrimary,
        height: 1.5,
      );

  static TextStyle get bodyS => GoogleFonts.inter(
        fontSize: 12,
        fontWeight: FontWeight.w400,
        color: AppColors.textSecondary,
        height: 1.4,
      );

  // ── Label / Caption ──────────────────────────────────────────────────────
  static TextStyle get labelL => GoogleFonts.inter(
        fontSize: 14,
        fontWeight: FontWeight.w500,
        color: AppColors.textPrimary,
      );

  static TextStyle get labelM => GoogleFonts.inter(
        fontSize: 12,
        fontWeight: FontWeight.w500,
        color: AppColors.textSecondary,
        letterSpacing: 0.2,
      );

  static TextStyle get caption => GoogleFonts.inter(
        fontSize: 11,
        fontWeight: FontWeight.w400,
        color: AppColors.textSecondary,
        letterSpacing: 0.1,
      );

  // ── Button ───────────────────────────────────────────────────────────────
  static TextStyle get buttonL => GoogleFonts.inter(
        fontSize: 16,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.1,
      );

  static TextStyle get buttonM => GoogleFonts.inter(
        fontSize: 14,
        fontWeight: FontWeight.w600,
        letterSpacing: 0.1,
      );
}
