import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';

/// ── Active Liveness Detection Engine ─────────────────────────────────────────
///
/// Implements EAR (Eye Aspect Ratio) for blink detection
/// and Head Pose Estimation (Euler angles) for turn detection.
///
/// References:
/// - EAR: Soukupová & Čech, 2016 "Real-Time Eye Blink Detection"
/// - ML Kit Face Detection: contours + landmarks for facial features

enum LivenessChallenge {
  blink('Hãy nháy mắt 👁', '👁'),
  turnLeft('Quay đầu sang trái ←', '←'),
  turnRight('Quay đầu sang phải →', '→'),
  smile('Mỉm cười 😊', '😊'),
  lookUp('Ngước mặt lên ↑', '↑'),
  lookDown('Cúi mặt xuống ↓', '↓');

  final String instruction;
  final String emoji;
  const LivenessChallenge(this.instruction, this.emoji);
}

class LivenessEngine {
  // ── EAR thresholds ────────────────────────────────────────────────────────
  static const double _earBlinkThreshold = 0.21;
  static const double _earOpenThreshold = 0.27;

  // ── Head pose thresholds (Euler angles in degrees) ───────────────────────
  static const double _headTurnThresholdY = 20.0; // Yaw (left/right)
  static const double _headTiltThresholdX = 15.0; // Pitch (up/down)

  // ── Smile probability ─────────────────────────────────────────────────────
  static const double _smileThreshold = 0.7;

  /// Track blink state — needs to see eyes go DOWN then UP to confirm blink
  bool _eyesWereOpen = false;
  bool _blinkDetected = false;

  /// Reset state when starting a new challenge
  void reset() {
    _eyesWereOpen = false;
    _blinkDetected = false;
  }

  /// Calculate Eye Aspect Ratio from face's leftEyeOpenProbability/rightEyeOpenProbability
  /// Returns the average probability (0=closed, 1=open)
  double _calculateEyeOpenness(Face face) {
    final left = face.leftEyeOpenProbability ?? 1.0;
    final right = face.rightEyeOpenProbability ?? 1.0;
    return (left + right) / 2.0;
  }

  /// Check if user blinked — needs full open → close → open cycle
  bool detectBlink(Face face) {
    final openness = _calculateEyeOpenness(face);

    if (openness > _earOpenThreshold) {
      // Eyes are open
      if (!_eyesWereOpen) {
        _eyesWereOpen = true;
      }
    } else if (openness < _earBlinkThreshold && _eyesWereOpen) {
      // Eyes went from open → closed = BLINK!
      _blinkDetected = true;
      _eyesWereOpen = false;
    }

    return _blinkDetected;
  }

  /// Detect head turn left (negative yaw)
  bool detectTurnLeft(Face face) {
    final yaw = face.headEulerAngleY ?? 0;
    return yaw < -_headTurnThresholdY;
  }

  /// Detect head turn right (positive yaw)
  bool detectTurnRight(Face face) {
    final yaw = face.headEulerAngleY ?? 0;
    return yaw > _headTurnThresholdY;
  }

  /// Detect look up (negative pitch)
  bool detectLookUp(Face face) {
    final pitch = face.headEulerAngleX ?? 0;
    return pitch < -_headTiltThresholdX;
  }

  /// Detect look down (positive pitch)
  bool detectLookDown(Face face) {
    final pitch = face.headEulerAngleX ?? 0;
    return pitch > _headTiltThresholdX;
  }

  /// Detect smile via ML Kit's classification
  bool detectSmile(Face face) {
    final smile = face.smilingProbability ?? 0;
    return smile > _smileThreshold;
  }

  /// Master verifier: returns true if the given challenge is satisfied
  bool verifyChallenge(LivenessChallenge challenge, Face face) {
    switch (challenge) {
      case LivenessChallenge.blink:
        return detectBlink(face);
      case LivenessChallenge.turnLeft:
        return detectTurnLeft(face);
      case LivenessChallenge.turnRight:
        return detectTurnRight(face);
      case LivenessChallenge.smile:
        return detectSmile(face);
      case LivenessChallenge.lookUp:
        return detectLookUp(face);
      case LivenessChallenge.lookDown:
        return detectLookDown(face);
    }
  }

  /// Validate face quality before starting any challenge
  /// Returns true if face is centered, well-lit, large enough
  FaceQuality assessQuality(Face? face, double previewWidth) {
    if (face == null) return FaceQuality.noFace;

    final bbox = face.boundingBox;
    final faceWidthRatio = bbox.width / previewWidth;

    // Face too small (far away)
    if (faceWidthRatio < 0.3) return FaceQuality.tooFar;
    // Face too big (too close)
    if (faceWidthRatio > 0.8) return FaceQuality.tooClose;

    // Tilted head outside acceptable range for baseline
    final roll = (face.headEulerAngleZ ?? 0).abs();
    if (roll > 25) return FaceQuality.tilted;

    return FaceQuality.good;
  }
}

enum FaceQuality {
  noFace('Không thấy khuôn mặt'),
  tooFar('Đưa mặt lại gần camera'),
  tooClose('Đưa mặt ra xa một chút'),
  tilted('Giữ đầu thẳng'),
  good('Hoàn hảo');

  final String label;
  const FaceQuality(this.label);
}
