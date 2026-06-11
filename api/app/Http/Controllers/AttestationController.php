<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class AttestationController extends Controller
{
    /**
     * POST /api/attest/verify
     *
     * Validates a Play Integrity (Android) / App Attest (iOS) token so the
     * server can refuse to enrol biometrics or perform high-value transfers
     * from a tampered APK, emulator, or jailbroken iPhone.
     *
     * STATUS: NOT YET INTEGRATED.
     *
     * Implementing this for real needs:
     *   - Android: a Google Cloud project + Play Integrity API enabled + a
     *     service account key. The server JWT-decodes the token, calls
     *     Google's `decodeIntegrityToken` to get the verdict, checks the
     *     verdict claims (`appIntegrity.appRecognitionVerdict == PLAY_RECOGNIZED`,
     *     `deviceIntegrity.deviceRecognitionVerdict contains MEETS_DEVICE_INTEGRITY`,
     *     `requestDetails.requestPackageName == "com.budgetbee.app"`,
     *     `requestDetails.requestHash` matches the nonce we issued).
     *   - iOS: configure App Attest in Apple Developer, then the server
     *     validates the assertion's CBOR payload using Apple's public root
     *     CA (the chain ships in the asserstion).
     *
     * Until those are configured we keep the endpoint as 501 so callers get
     * an honest signal that attestation is not yet enforced. Critically,
     * we DO NOT silently return 200 — that would let a tampered client
     * sneak through assuming attestation passed.
     *
     * Configure to enable:
     *   - `.env`  PLAY_INTEGRITY_PROJECT_NUMBER=...
     *   - `.env`  APP_ATTEST_TEAM_ID=...
     *   - `composer require google/cloud-play-integrity` (for Android)
     *   - implement the two TODO blocks below
     */
    public function verify(Request $request)
    {
        $v = $request->validate([
            'platform' => 'required|string|in:android,ios',
            'attestation' => 'required|string|max:8192',
            'nonce' => 'nullable|string|max:128',
        ]);

        Log::channel('audit')->info('attestation_attempt', [
            'platform' => $v['platform'],
            'has_nonce' => !empty($v['nonce']),
        ]);

        $androidConfigured = (bool) env('PLAY_INTEGRITY_PROJECT_NUMBER');
        $iosConfigured = (bool) env('APP_ATTEST_TEAM_ID');

        if ($v['platform'] === 'android' && !$androidConfigured) {
            return response()->json([
                'ok' => false,
                'configured' => false,
                'message' => 'Play Integrity chưa được cấu hình trên server. Liên hệ admin.',
            ], 501);
        }
        if ($v['platform'] === 'ios' && !$iosConfigured) {
            return response()->json([
                'ok' => false,
                'configured' => false,
                'message' => 'App Attest chưa được cấu hình trên server. Liên hệ admin.',
            ], 501);
        }

        // TODO(android): Decode JWT, call Google decodeIntegrityToken,
        // verify verdicts + package name + request hash. Reference:
        // https://developer.android.com/google/play/integrity/verdicts
        // TODO(ios):     CBOR-decode assertion, verify against Apple App
        // Attest root CA, check key id matches a registered DeviceCheck key.

        Log::channel('audit')->warning('attestation_unimplemented_verify', [
            'platform' => $v['platform'],
        ]);

        return response()->json([
            'ok' => false,
            'configured' => true,
            'message' => 'Logic xác minh attestation chưa triển khai.',
        ], 501);
    }
}
