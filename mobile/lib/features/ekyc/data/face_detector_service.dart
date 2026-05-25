import 'dart:io';
import 'dart:ui' show Size;
import 'package:flutter/foundation.dart';
import 'package:camera/camera.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Wraps Google ML Kit Face Detection with appropriate options for liveness
class FaceDetectorService {
  late final FaceDetector _detector;

  FaceDetectorService() {
    _detector = FaceDetector(
      options: FaceDetectorOptions(
        enableLandmarks: true,
        enableClassification: true,    // smile + eyeOpen probability
        enableTracking: true,           // keep ID consistent across frames
        enableContours: false,          // contours costly, not needed for active liveness
        performanceMode: FaceDetectorMode.fast,
        minFaceSize: 0.15,             // ignore faces < 15% of frame
      ),
    );
  }

  /// Detect faces from a CameraImage frame
  Future<List<Face>> detectFromCameraImage(
    CameraImage image,
    CameraDescription camera,
  ) async {
    try {
      final inputImage = _toInputImage(image, camera);
      if (inputImage == null) return [];
      return await _detector.processImage(inputImage);
    } catch (e) {
      debugPrint('FaceDetector error: $e');
      return [];
    }
  }

  InputImage? _toInputImage(CameraImage image, CameraDescription camera) {
    final WriteBuffer allBytes = WriteBuffer();
    for (final Plane plane in image.planes) {
      allBytes.putUint8List(plane.bytes);
    }
    final bytes = allBytes.done().buffer.asUint8List();

    final Size imageSize = Size(image.width.toDouble(), image.height.toDouble());

    final imageRotation = _rotationFromSensor(camera.sensorOrientation);
    if (imageRotation == null) return null;

    final inputImageFormat = InputImageFormatValue.fromRawValue(image.format.raw);
    if (inputImageFormat == null) return null;

    return InputImage.fromBytes(
      bytes: bytes,
      metadata: InputImageMetadata(
        size: imageSize,
        rotation: imageRotation,
        format: inputImageFormat,
        bytesPerRow: image.planes[0].bytesPerRow,
      ),
    );
  }

  InputImageRotation? _rotationFromSensor(int sensorOrientation) {
    if (Platform.isIOS) {
      return InputImageRotationValue.fromRawValue(sensorOrientation);
    }
    // Android: sensor orientation typically 90/270 for front
    switch (sensorOrientation) {
      case 0:
        return InputImageRotation.rotation0deg;
      case 90:
        return InputImageRotation.rotation90deg;
      case 180:
        return InputImageRotation.rotation180deg;
      case 270:
        return InputImageRotation.rotation270deg;
      default:
        return InputImageRotation.rotation0deg;
    }
  }

  Future<void> dispose() async {
    await _detector.close();
  }
}

final faceDetectorProvider = Provider<FaceDetectorService>((ref) {
  final svc = FaceDetectorService();
  ref.onDispose(() => svc.dispose());
  return svc;
});
