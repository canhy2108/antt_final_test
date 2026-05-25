import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:camera/camera.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import 'dart:math';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_text_styles.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/router/app_router.dart';
import '../domain/liveness_engine.dart';
import '../data/face_detector_service.dart';

/// ── eKYC Page — Multi-step verification flow ─────────────────────────────────
///
/// Steps:
/// 1. Intro screen — explain privacy + start
/// 2. Camera permission
/// 3. Face capture + Active Liveness challenges (random 3 of 6)
/// 4. Success / Failure result

enum EkycStep { intro, capture, success, failure }

class EkycPage extends ConsumerStatefulWidget {
  const EkycPage({super.key});
  @override
  ConsumerState<EkycPage> createState() => _EkycPageState();
}

class _EkycPageState extends ConsumerState<EkycPage> {
  EkycStep _step = EkycStep.intro;
  String _failureReason = '';

  void _start() {
    setState(() => _step = EkycStep.capture);
  }

  void _onSuccess() {
    HapticFeedback.heavyImpact();
    setState(() => _step = EkycStep.success);
  }

  void _onFailure(String reason) {
    HapticFeedback.heavyImpact();
    setState(() {
      _failureReason = reason;
      _step = EkycStep.failure;
    });
  }

  void _retry() {
    setState(() {
      _step = EkycStep.capture;
      _failureReason = '';
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _step == EkycStep.capture
        ? Colors.black
        : AppColors.background,
      body: AnimatedSwitcher(
        duration: const Duration(milliseconds: 300),
        child: switch (_step) {
          EkycStep.intro => _IntroView(onStart: _start, key: const ValueKey('intro')),
          EkycStep.capture => _CaptureView(
              key: const ValueKey('capture'),
              onSuccess: _onSuccess,
              onFailure: _onFailure,
            ),
          EkycStep.success => _SuccessView(key: const ValueKey('success')),
          EkycStep.failure => _FailureView(
              key: const ValueKey('failure'),
              reason: _failureReason,
              onRetry: _retry,
            ),
        },
      ),
    );
  }
}

// ── Intro View ───────────────────────────────────────────────────────────────
class _IntroView extends StatelessWidget {
  final VoidCallback onStart;
  const _IntroView({super.key, required this.onStart});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(AppTheme.pageHorizontal),
        child: Column(
          children: [
            const SizedBox(height: 8),
            Row(
              children: [
                GestureDetector(
                  onTap: () => context.pop(),
                  child: Container(
                    width: 44, height: 44,
                    decoration: BoxDecoration(
                      color: AppColors.surface, shape: BoxShape.circle,
                      boxShadow: AppTheme.shadowS,
                    ),
                    child: const Icon(Icons.arrow_back_rounded, size: 22),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 32),
            Container(
              width: 120, height: 120,
              decoration: BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(AppTheme.radiusXL),
                boxShadow: AppTheme.shadowGreen,
              ),
              child: const Icon(Icons.face_retouching_natural_rounded,
                  size: 64, color: AppColors.dark),
            ),
            const SizedBox(height: 32),
            Text('Xác minh danh tính', style: AppTextStyles.displayM,
                textAlign: TextAlign.center),
            const SizedBox(height: 12),
            Text(
              'Chúng tôi cần xác minh bạn là người thật\nđể bảo vệ tài khoản và tài chính',
              style: AppTextStyles.bodyM.copyWith(color: AppColors.textSecondary),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 40),
            ...[
              ('🔒', 'Dữ liệu được mã hoá', 'Hình ảnh chỉ dùng để xác minh, không lưu trữ'),
              ('⚡', 'Nhanh chóng', 'Hoàn tất trong dưới 30 giây'),
              ('🎯', 'Chính xác', 'Phân tích chuyển động tự nhiên (Active Liveness)'),
            ].map((item) => Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Row(
                children: [
                  Text(item.$1, style: const TextStyle(fontSize: 28)),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(item.$2, style: AppTextStyles.headingS),
                        Text(item.$3, style: AppTextStyles.bodyS),
                      ],
                    ),
                  ),
                ],
              ),
            )),
            const Spacer(),
            ElevatedButton(
              onPressed: onStart,
              child: const Text('Bắt đầu xác minh'),
            ),
            const SizedBox(height: 12),
            Text(
              'Bằng cách tiếp tục, bạn đồng ý với Chính sách bảo mật',
              style: AppTextStyles.caption,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}

// ── Capture View — Camera + Liveness Detection ───────────────────────────────
class _CaptureView extends ConsumerStatefulWidget {
  final VoidCallback onSuccess;
  final ValueChanged<String> onFailure;
  const _CaptureView({super.key, required this.onSuccess, required this.onFailure});

  @override
  ConsumerState<_CaptureView> createState() => _CaptureViewState();
}

class _CaptureViewState extends ConsumerState<_CaptureView> {
  CameraController? _camera;
  bool _initialized = false;
  bool _processing = false;
  final _engine = LivenessEngine();

  // Random sequence of 3 challenges (out of 6 possible)
  late final List<LivenessChallenge> _challenges;
  int _currentIdx = 0;
  int _stableFramesNeeded = 0;
  FaceQuality _quality = FaceQuality.noFace;

  @override
  void initState() {
    super.initState();
    // Pick 3 random challenges (no duplicates)
    final all = LivenessChallenge.values.toList()..shuffle(Random());
    _challenges = all.take(3).toList();
    _initCamera();
  }

  Future<void> _initCamera() async {
    try {
      final cameras = await availableCameras();
      // Find front camera
      final front = cameras.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.front,
        orElse: () => cameras.first,
      );

      _camera = CameraController(
        front,
        ResolutionPreset.medium,
        enableAudio: false,
        imageFormatGroup: ImageFormatGroup.nv21,
      );

      await _camera!.initialize();
      if (!mounted) return;

      // Start image stream for face detection
      await _camera!.startImageStream(_onCameraImage);
      setState(() => _initialized = true);
    } catch (e) {
      widget.onFailure('Không thể khởi tạo camera. Vui lòng cấp quyền và thử lại.');
    }
  }

  Future<void> _onCameraImage(CameraImage image) async {
    if (_processing || !mounted) return;
    _processing = true;

    try {
      final detector = ref.read(faceDetectorProvider);
      final faces = await detector.detectFromCameraImage(image, _camera!.description);

      if (!mounted) return;

      final face = faces.isNotEmpty ? faces.first : null;
      final newQuality = _engine.assessQuality(face, image.width.toDouble());

      setState(() => _quality = newQuality);

      if (face == null || newQuality != FaceQuality.good) {
        _processing = false;
        return;
      }

      // Check current challenge
      final current = _challenges[_currentIdx];
      final passed = _engine.verifyChallenge(current, face);

      if (passed) {
        _stableFramesNeeded++;
        // Require 3 stable frames to confirm challenge
        if (_stableFramesNeeded >= 3) {
          HapticFeedback.mediumImpact();
          _stableFramesNeeded = 0;
          _engine.reset();

          if (_currentIdx + 1 >= _challenges.length) {
            // All challenges passed!
            await _camera?.stopImageStream();
            widget.onSuccess();
          } else {
            setState(() => _currentIdx++);
          }
        }
      } else {
        _stableFramesNeeded = 0;
      }
    } catch (_) {} finally {
      _processing = false;
    }
  }

  @override
  void dispose() {
    _camera?.stopImageStream();
    _camera?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_initialized) {
      return const Center(child: CircularProgressIndicator(color: AppColors.primary));
    }

    final current = _challenges[_currentIdx];
    final progress = (_currentIdx + 1) / _challenges.length;

    return Stack(
      children: [
        // Camera preview
        Positioned.fill(child: CameraPreview(_camera!)),

        // Dark overlay with circular cutout
        Positioned.fill(
          child: CustomPaint(painter: _FaceFramePainter(quality: _quality)),
        ),

        // Top bar
        Positioned(
          top: 0, left: 0, right: 0,
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: () => Navigator.pop(context),
                    child: Container(
                      width: 44, height: 44,
                      decoration: BoxDecoration(
                        color: Colors.black54,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.close_rounded,
                          color: Colors.white, size: 22),
                    ),
                  ),
                  const Spacer(),
                  // Progress
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: Colors.black54,
                      borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                    ),
                    child: Text(
                      '${_currentIdx + 1}/${_challenges.length}',
                      style: AppTextStyles.labelL.copyWith(color: AppColors.primary),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),

        // Bottom instruction card
        Positioned(
          bottom: 0, left: 0, right: 0,
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(AppTheme.radiusXL),
                  boxShadow: AppTheme.shadowL,
                ),
                child: Column(
                  children: [
                    // Progress bar
                    ClipRRect(
                      borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                      child: LinearProgressIndicator(
                        value: progress,
                        minHeight: 6,
                        backgroundColor: AppColors.grey200,
                        valueColor: const AlwaysStoppedAnimation(AppColors.primary),
                      ),
                    ),
                    const SizedBox(height: 16),
                    // Quality status
                    if (_quality != FaceQuality.good)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        margin: const EdgeInsets.only(bottom: 12),
                        decoration: BoxDecoration(
                          color: AppColors.warning.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.warning_amber_rounded,
                                size: 16, color: AppColors.warning),
                            const SizedBox(width: 6),
                            Text(_quality.label,
                                style: AppTextStyles.labelM.copyWith(color: AppColors.warning)),
                          ],
                        ),
                      ),
                    // Challenge instruction
                    Text(current.emoji,
                        style: const TextStyle(fontSize: 48)),
                    const SizedBox(height: 8),
                    Text(current.instruction,
                        style: AppTextStyles.headingL,
                        textAlign: TextAlign.center),
                    const SizedBox(height: 4),
                    Text('Bước ${_currentIdx + 1} / ${_challenges.length}',
                        style: AppTextStyles.bodyS),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

// ── Face Frame Overlay Painter ───────────────────────────────────────────────
class _FaceFramePainter extends CustomPainter {
  final FaceQuality quality;
  _FaceFramePainter({required this.quality});

  @override
  void paint(Canvas canvas, Size size) {
    // Dim overlay
    final overlayPath = Path()..addRect(Rect.fromLTWH(0, 0, size.width, size.height));
    final ovalRect = Rect.fromCenter(
      center: Offset(size.width / 2, size.height * 0.42),
      width: size.width * 0.75,
      height: size.width * 0.95,
    );
    final ovalPath = Path()..addOval(ovalRect);

    canvas.drawPath(
      Path.combine(PathOperation.difference, overlayPath, ovalPath),
      Paint()..color = Colors.black.withValues(alpha: 0.6),
    );

    // Border ring
    final ringColor = quality == FaceQuality.good ? AppColors.primary : AppColors.warning;
    canvas.drawOval(
      ovalRect,
      Paint()
        ..color = ringColor
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3,
    );
  }

  @override
  bool shouldRepaint(_FaceFramePainter old) => old.quality != quality;
}

// ── Success View ─────────────────────────────────────────────────────────────
class _SuccessView extends StatelessWidget {
  const _SuccessView({super.key});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(AppTheme.pageHorizontal),
        child: Column(
          children: [
            const Spacer(),
            TweenAnimationBuilder<double>(
              tween: Tween(begin: 0, end: 1),
              duration: const Duration(milliseconds: 600),
              curve: Curves.elasticOut,
              builder: (_, value, child) => Transform.scale(scale: value, child: child),
              child: Container(
                width: 140, height: 140,
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  shape: BoxShape.circle,
                  boxShadow: AppTheme.shadowGreen,
                ),
                child: const Icon(Icons.check_rounded,
                    size: 84, color: AppColors.dark),
              ),
            ),
            const SizedBox(height: 32),
            Text('Xác minh thành công! 🎉',
                style: AppTextStyles.displayM, textAlign: TextAlign.center),
            const SizedBox(height: 12),
            Text(
              'Bạn đã xác minh danh tính thành công.\nTài khoản của bạn đã được bảo vệ.',
              style: AppTextStyles.bodyM.copyWith(color: AppColors.textSecondary),
              textAlign: TextAlign.center,
            ),
            const Spacer(),
            ElevatedButton(
              onPressed: () => context.go(AppRoutes.dashboard),
              child: const Text('Tiếp tục'),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }
}

// ── Failure View ─────────────────────────────────────────────────────────────
class _FailureView extends StatelessWidget {
  final String reason;
  final VoidCallback onRetry;
  const _FailureView({super.key, required this.reason, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(AppTheme.pageHorizontal),
        child: Column(
          children: [
            const Spacer(),
            Container(
              width: 120, height: 120,
              decoration: BoxDecoration(
                color: AppColors.expense.withValues(alpha: 0.15),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.error_outline_rounded,
                  size: 64, color: AppColors.expense),
            ),
            const SizedBox(height: 32),
            Text('Xác minh không thành công',
                style: AppTextStyles.displayM, textAlign: TextAlign.center),
            const SizedBox(height: 12),
            Text(
              reason.isEmpty
                ? 'Vui lòng thử lại trong điều kiện ánh sáng tốt hơn'
                : reason,
              style: AppTextStyles.bodyM.copyWith(color: AppColors.textSecondary),
              textAlign: TextAlign.center,
            ),
            const Spacer(),
            ElevatedButton(
              onPressed: onRetry,
              child: const Text('Thử lại'),
            ),
            const SizedBox(height: 12),
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text('Để sau',
                  style: AppTextStyles.bodyM.copyWith(color: AppColors.textSecondary)),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }
}
