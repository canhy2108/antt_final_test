import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/theme/app_theme.dart';

/// Password field with show/hide toggle + optional strength indicator
class PasswordField extends StatefulWidget {
  final TextEditingController controller;
  final String label;
  final String? hint;
  final String? Function(String?)? validator;
  final bool showStrengthMeter;
  final TextInputAction? textInputAction;
  final VoidCallback? onFieldSubmitted;

  const PasswordField({
    super.key,
    required this.controller,
    this.label = 'Mật khẩu',
    this.hint = '••••••••••••',
    this.validator,
    this.showStrengthMeter = false,
    this.textInputAction,
    this.onFieldSubmitted,
  });

  @override
  State<PasswordField> createState() => _PasswordFieldState();
}

class _PasswordFieldState extends State<PasswordField> {
  bool _obscure = true;
  PasswordStrength _strength = PasswordStrength.empty;

  void _onChanged(String value) {
    if (widget.showStrengthMeter) {
      setState(() => _strength = _evaluate(value));
    }
  }

  PasswordStrength _evaluate(String pass) {
    if (pass.isEmpty) return PasswordStrength.empty;
    if (pass.length < 8) return PasswordStrength.weak;

    int score = 0;
    if (pass.length >= 12) score++;
    if (pass.length >= 16) score++;
    if (RegExp(r'[A-Z]').hasMatch(pass)) score++;
    if (RegExp(r'[a-z]').hasMatch(pass)) score++;
    if (RegExp(r'[0-9]').hasMatch(pass)) score++;
    if (RegExp(r'[!@#\$%^&*(),.?":{}|<>]').hasMatch(pass)) score++;
    if (pass.split(' ').length > 1) score++; // passphrase bonus

    if (score <= 2) return PasswordStrength.weak;
    if (score <= 4) return PasswordStrength.fair;
    if (score <= 5) return PasswordStrength.strong;
    return PasswordStrength.veryStrong;
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextFormField(
          controller: widget.controller,
          obscureText: _obscure,
          textInputAction: widget.textInputAction,
          autofillHints: const [AutofillHints.password],
          onChanged: _onChanged,
          onFieldSubmitted: widget.onFieldSubmitted != null
              ? (_) => widget.onFieldSubmitted!()
              : null,
          validator: widget.validator,
          style: AppTextStyles.bodyL,
          decoration: InputDecoration(
            labelText: widget.label,
            hintText: widget.hint,
            prefixIcon: const Icon(Icons.lock_outline_rounded,
                color: AppColors.textSecondary, size: 20),
            suffixIcon: GestureDetector(
              onTap: () => setState(() => _obscure = !_obscure),
              child: Icon(
                _obscure
                    ? Icons.visibility_off_outlined
                    : Icons.visibility_outlined,
                color: AppColors.textSecondary,
                size: 20,
              ),
            ),
          ),
        ),

        // Strength meter
        if (widget.showStrengthMeter && _strength != PasswordStrength.empty) ...[
          const SizedBox(height: 8),
          _StrengthMeter(strength: _strength),
          const SizedBox(height: 4),
          Text(
            _strength.label,
            style: AppTextStyles.caption.copyWith(color: _strength.color),
          ),
          if (_strength == PasswordStrength.weak) ...[
            const SizedBox(height: 4),
            Text(
              'Gợi ý: Dùng cụm từ dài như "trời-xanh-mây-trắng-2026" (≥12 ký tự)',
              style: AppTextStyles.caption,
            ),
          ],
        ],
      ],
    );
  }
}

// ── Strength Meter Visual ─────────────────────────────────────────────────────
class _StrengthMeter extends StatelessWidget {
  final PasswordStrength strength;
  const _StrengthMeter({required this.strength});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: List.generate(4, (i) {
        final filled = i < strength.level;
        return Expanded(
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 300),
            margin: EdgeInsets.only(right: i < 3 ? 4 : 0),
            height: 4,
            decoration: BoxDecoration(
              color: filled ? strength.color : AppColors.grey200,
              borderRadius: BorderRadius.circular(AppTheme.radiusFull),
            ),
          ),
        );
      }),
    );
  }
}

enum PasswordStrength {
  empty(0, 'Trống', AppColors.grey200),
  weak(1, 'Yếu — Dễ bị hack', AppColors.expense),
  fair(2, 'Trung bình', AppColors.warning),
  strong(3, 'Mạnh', AppColors.income),
  veryStrong(4, 'Rất mạnh 💪', Color(0xFF16A34A));

  const PasswordStrength(this.level, this.label, this.color);
  final int level;
  final String label;
  final Color color;
}
