import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';

class PinSetupPage extends StatelessWidget {
  const PinSetupPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(title: Text('PinSetupPage')),
      body: Center(
        child: Text('PinSetupPage — Coming Soon', style: AppTextStyles.bodyL),
      ),
    );
  }
}
