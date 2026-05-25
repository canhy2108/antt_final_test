import 'package:dio/dio.dart';
import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import '../security/secure_storage_service.dart';

/// Secure API Client using Dio
/// - HttpOnly cookies cho token (thay vì localStorage)
/// - Auto refresh token khi 401
/// - Certificate validation (thêm pinning ở production)
/// - Request/Response interceptors
class ApiClient {
  late final Dio _dio;
  late final PersistCookieJar _cookieJar;
  final SecureStorageService _storage;

  /// Base URL — override theo environment
  static const String _baseUrl =
      String.fromEnvironment('API_BASE_URL', defaultValue: 'http://10.0.2.2/api');

  ApiClient(this._storage);

  Future<void> init() async {
    final dir = await getApplicationDocumentsDirectory();
    _cookieJar = PersistCookieJar(
      ignoreExpires: false,
      storage: FileStorage('${dir.path}/.cookies/'),
    );

    _dio = Dio(BaseOptions(
      baseUrl: _baseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 30),
      sendTimeout: const Duration(seconds: 30),
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest', // CSRF hint
      },
    ));

    // Cookie manager — auto-send HttpOnly cookies
    _dio.interceptors.add(CookieManager(_cookieJar));

    // Auth interceptor — inject Bearer token + auto-refresh
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: _onRequest,
        onResponse: _onResponse,
        onError: _onError,
      ),
    );

    // Logger — ONLY in debug mode, NEVER in release
    assert(() {
      _dio.interceptors.add(
        LogInterceptor(
          requestBody: true,
          responseBody: true,
          // NEVER log Authorization header content in production
          requestHeader: false,
        ),
      );
      return true;
    }());
  }

  void _onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    final token = await _storage.getAccessToken();
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    // Update session activity timestamp
    await _storage.updateLastActive();
    handler.next(options);
  }

  void _onResponse(Response response, ResponseInterceptorHandler handler) {
    // Extract token from response header if present (first login)
    final authHeader = response.headers.value('Authorization');
    if (authHeader != null && authHeader.startsWith('Bearer ')) {
      final token = authHeader.substring(7);
      _storage.saveTokens(
        accessToken: token,
        refreshToken: null,
        expiry: DateTime.now().add(const Duration(minutes: 30)),
      );
    }
    handler.next(response);
  }

  Future<void> _onError(
      DioException err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode == 401) {
      // Attempt token refresh
      final refreshed = await _tryRefreshToken();
      if (refreshed) {
        // Retry original request
        try {
          final token = await _storage.getAccessToken();
          final opts = err.requestOptions;
          opts.headers['Authorization'] = 'Bearer $token';
          final response = await _dio.fetch(opts);
          return handler.resolve(response);
        } catch (_) {}
      }
      // Refresh failed → clear session, redirect to login handled by router
      await _storage.clearSession();
    }
    handler.next(err);
  }

  Future<bool> _tryRefreshToken() async {
    try {
      final refreshToken = await _storage.getRefreshToken();
      if (refreshToken == null) return false;

      final response = await Dio().post(
        '$_baseUrl/auth/refresh',
        data: {'refresh_token': refreshToken},
      );

      if (response.statusCode == 200) {
        final data = response.data;
        await _storage.saveTokens(
          accessToken: data['access_token'],
          refreshToken: data['refresh_token'],
          expiry: DateTime.now().add(const Duration(minutes: 30)),
        );
        return true;
      }
    } catch (_) {}
    return false;
  }

  Dio get dio => _dio;

  // ── Convenience Methods ───────────────────────────────────────────────────
  Future<Response<T>> get<T>(String path,
          {Map<String, dynamic>? queryParameters}) =>
      _dio.get(path, queryParameters: queryParameters);

  Future<Response<T>> post<T>(String path, {dynamic data}) =>
      _dio.post(path, data: data);

  Future<Response<T>> put<T>(String path, {dynamic data}) =>
      _dio.put(path, data: data);

  Future<Response<T>> delete<T>(String path) => _dio.delete(path);
}

// ── Providers ────────────────────────────────────────────────────────────────
final apiClientProvider = Provider<ApiClient>((ref) {
  final storage = ref.read(secureStorageProvider);
  return ApiClient(storage);
});

final apiClientInitProvider = FutureProvider<ApiClient>((ref) async {
  final client = ref.read(apiClientProvider);
  await client.init();
  return client;
});
