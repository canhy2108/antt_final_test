import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/models/transaction_model.dart';
import '../../../core/network/api_client.dart';

class AccountRepository {
  final ApiClient _api;
  AccountRepository(this._api);

  Future<List<AccountModel>> getAll() async {
    try {
      final res = await _api.get('/account');
      final List data = res.data is List ? res.data : [];
      return data.map((e) => AccountModel.fromJson(e)).toList();
    } catch (_) {
      return [];
    }
  }
}

final accountRepoProvider = Provider<AccountRepository>((ref) {
  return AccountRepository(ref.read(apiClientProvider));
});

final accountsProvider =
    FutureProvider.autoDispose<List<AccountModel>>((ref) {
  return ref.read(accountRepoProvider).getAll();
});
