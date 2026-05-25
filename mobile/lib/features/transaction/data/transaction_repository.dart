import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/models/transaction_model.dart';
import '../../../core/network/api_client.dart';

class TransactionRepository {
  final ApiClient _api;
  TransactionRepository(this._api);

  Future<List<TransactionModel>> getRecent({int limit = 10}) async {
    try {
      final res = await _api.get('/record/last', queryParameters: {
        'limit': limit,
      });
      final List data = res.data is List ? res.data : [];
      return data.map((e) => TransactionModel.fromJson(e)).toList();
    } catch (_) {
      return [];
    }
  }

  Future<List<TransactionModel>> getAll({
    int page = 1,
    String? type,
    String? fromDate,
    String? toDate,
    String? search,
  }) async {
    try {
      final params = <String, dynamic>{'page': page};
      if (type != null) params['type'] = type;
      if (fromDate != null) params['from_date'] = fromDate;
      if (toDate != null) params['to_date'] = toDate;
      if (search != null) params['search_term'] = search;

      final res = await _api.get('/record', queryParameters: params);
      final List data = res.data is List ? res.data : [];
      return data.map((e) => TransactionModel.fromJson(e)).toList();
    } catch (_) {
      return [];
    }
  }

  Future<Map<String, double>> getMonthStats() async {
    try {
      final now = DateTime.now();
      final from = DateTime(now.year, now.month, 1).toIso8601String().split('T')[0];
      final to = now.toIso8601String().split('T')[0];

      final res = await _api.get('/balance/all', queryParameters: {
        'from_date': from,
        'to_date': to,
      });
      final data = res.data as Map<String, dynamic>? ?? {};
      return {
        'income': (data['income'] as num?)?.toDouble() ?? 0,
        'expense': (data['expense'] as num?)?.abs().toDouble() ?? 0,
        'balance': (data['balance'] as num?)?.toDouble() ?? 0,
      };
    } catch (_) {
      return {'income': 0, 'expense': 0, 'balance': 0};
    }
  }

  Future<bool> create(Map<String, dynamic> data) async {
    try {
      await _api.post('/record', data: data);
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<bool> update(String id, Map<String, dynamic> data) async {
    try {
      await _api.post('/record/$id', data: data);
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<bool> delete(String id) async {
    try {
      await _api.delete('/record/$id');
      return true;
    } catch (_) {
      return false;
    }
  }
}

// ── Providers ─────────────────────────────────────────────────────────────────
final transactionRepoProvider = Provider<TransactionRepository>((ref) {
  return TransactionRepository(ref.read(apiClientProvider));
});

final recentTransactionsProvider =
    FutureProvider.autoDispose<List<TransactionModel>>((ref) {
  return ref.read(transactionRepoProvider).getRecent(limit: 10);
});

final monthStatsProvider =
    FutureProvider.autoDispose<Map<String, double>>((ref) {
  return ref.read(transactionRepoProvider).getMonthStats();
});
