import Foundation
import Security

@objc(BiometricHardware)
class BiometricHardware: NSObject {
    @objc
    func enroll(_ alias: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        let access = SecAccessControlCreateWithFlags(nil, kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly, .biometryCurrentSet, nil)

        let attributes: [String: Any] = [
            kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
            kSecAttrKeySizeInBits as String: 256,
            kSecAttrTokenID as String: kSecAttrTokenIDSecureEnclave,
            kSecPrivateKeyAttrs as String: [
                kSecAttrIsPermanent as String: true,
                kSecAttrApplicationTag as String: alias.data(using: .utf8)!,
                kSecAttrAccessControl as String: access as Any
            ]
        ]

        var error: Unmanaged<CFError>?
        guard let privateKey = SecKeyCreateRandomKey(attributes as CFDictionary, &error) else {
            reject("ENROLL_FAIL", "Failed to create key: \(String(describing: error?.takeRetainedValue()))", nil)
            return
        }
        guard let publicKey = SecKeyCopyPublicKey(privateKey) else {
            reject("ENROLL_FAIL", "Failed to copy public key", nil)
            return
        }
        var pubError: Unmanaged<CFError>?
        guard let pubData = SecKeyCopyExternalRepresentation(publicKey, &pubError) as Data? else {
            reject("ENROLL_FAIL", "Failed to export public key: \(String(describing: pubError?.takeRetainedValue()))", nil)
            return
        }
        let b64 = pubData.base64EncodedString()
        resolve(["publicKey": b64])
    }

    @objc
    func sign(_ challengeB64: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let challengeData = Data(base64Encoded: challengeB64) else {
            reject("INVALID_CHALLENGE", "Challenge not base64", nil); return
        }

        let query: [String: Any] = [
            kSecClass as String: kSecClassKey,
            kSecAttrApplicationTag as String: aliasDataPlaceholder(),
            kSecReturnRef as String: true,
            kSecUseOperationPrompt as String: "Xác thực để ký giao dịch"
        ]

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status != errSecSuccess {
            reject("KEY_NOT_FOUND", "Private key not found: \(status)", nil); return
        }
        guard let privateKey = item as! SecKey? else { reject("KEY_NOT_FOUND", "No key ref", nil); return }

        var error: Unmanaged<CFError>?
        guard let signature = SecKeyCreateSignature(privateKey, .ecdsaSignatureMessageX962SHA256, challengeData as CFData, &error) as Data? else {
            reject("SIGN_FAIL", "Failed to sign: \(String(describing: error?.takeRetainedValue()))", nil); return
        }

        resolve(["signature": signature.base64EncodedString()])
    }

    // Placeholder to indicate the alias bytes — the real implementation must
    // agree on applicationTag with enroll() caller. For a production module,
    // store alias mapping or accept alias param on sign().
    private func aliasDataPlaceholder() -> Data {
        return "biometric_alias".data(using: .utf8)!
    }

    @objc
    static func requiresMainQueueSetup() -> Bool {
        return false
    }
}
