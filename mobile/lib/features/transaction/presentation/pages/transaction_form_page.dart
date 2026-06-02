import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/models/transaction_model.dart';
import '../../../transaction/data/transaction_repository.dart';

class TransactionFormPage extends ConsumerStatefulWidget {
  final String? recordId;
  const TransactionFormPage({super.key, this.recordId});
  @override
  ConsumerState<TransactionFormPage> createState() => _TransactionFormPageState();
}

class _TransactionFormPageState extends ConsumerState<TransactionFormPage>
    with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;
  final _noteCtrl = TextEditingController();
  String _amount = '0';
  DateTime _selectedDate = DateTime.now();
  String _selectedCategory = 'Ăn uống';
  String _selectedAccount = '';
  bool _loading = false;

  TransactionType get _type {
    switch (_tabCtrl.index) {
      case 0: return TransactionType.expense;
      case 1: return TransactionType.income;
      default: return TransactionType.transfer;
    }
  }

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 3, vsync: this);
    _tabCtrl.addListener(() => setState(() {}));
  }

  @override
  void dispose() { _tabCtrl.dispose(); _noteCtrl.dispose(); super.dispose(); }

  void _numpadInput(String val) {
    HapticFeedback.selectionClick();
    setState(() {
      if (val == 'DEL') {
        _amount = _amount.length <= 1 ? '0' : _amount.substring(0, _amount.length - 1);
      } else if (val == '.' && _amount.contains('.')) {
        return;
      } else if (_amount == '0' && val != '.') {
        _amount = val;
      } else {
        if (_amount.length < 12) _amount = _amount + val;
      }
    });
  }

  Future<void> _save() async {
    final amt = double.tryParse(_amount) ?? 0;
    if (amt == 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Nhập số tiền trước'), backgroundColor: AppColors.warning));
      return;
    }
    setState(() => _loading = true);
    final ok = await ref.read(transactionRepoProvider).create({
      'type': _type.name,
      'amount': amt,
      'date': DateFormat('yyyy-MM-dd').format(_selectedDate),
      'name': _noteCtrl.text.trim(),
      'from_account_id': 1,
    });
    if (mounted) {
      setState(() => _loading = false);
      if (ok) {
        ref.invalidate(recentTransactionsProvider);
        ref.invalidate(monthStatsProvider);
        HapticFeedback.mediumImpact();
        context.pop();
      }
    }
  }

  Color get _typeColor => _type == TransactionType.income
      ? AppColors.income
      : _type == TransactionType.expense ? AppColors.expense : AppColors.info;

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat('#,###', 'vi_VN');
    final displayAmount = _amount == '0' ? '0' : fmt.format(int.tryParse(_amount.replaceAll('.', '')) ?? 0);

    return Scaffold(
      backgroundColor: AppColors.dark,
      body: Column(children: [
        // ── Header: amount display ──────────────────────────────────
        SafeArea(bottom: false, child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
          child: Column(children: [
            Row(children: [
              GestureDetector(onTap: () => context.pop(),
                child: const Icon(Icons.close_rounded, color: Colors.white54, size: 24)),
              const Spacer(),
              Text('Giao dịch mới', style: AppTextStyles.headingM.copyWith(color: Colors.white)),
              const Spacer(),
              GestureDetector(onTap: _save,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  decoration: BoxDecoration(color: _typeColor, borderRadius: BorderRadius.circular(99)),
                  child: _loading
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : Text('Lưu', style: AppTextStyles.buttonM.copyWith(color: Colors.white)))),
            ]),
            const SizedBox(height: 24),
            // Tab selector
            Container(
              height: 44,
              decoration: BoxDecoration(color: Colors.white10, borderRadius: BorderRadius.circular(99)),
              child: TabBar(
                controller: _tabCtrl,
                indicator: BoxDecoration(color: _typeColor, borderRadius: BorderRadius.circular(99)),
                indicatorSize: TabBarIndicatorSize.tab,
                dividerColor: Colors.transparent,
                labelStyle: AppTextStyles.buttonM,
                labelColor: Colors.white,
                unselectedLabelColor: Colors.white54,
                tabs: const [Tab(text: 'Chi tiêu'), Tab(text: 'Thu nhập'), Tab(text: 'Chuyển')],
              ),
            ),
            const SizedBox(height: 24),
            // Amount
            Row(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text(displayAmount,
                style: AppTextStyles.displayXL.copyWith(color: Colors.white),
                overflow: TextOverflow.ellipsis),
              const SizedBox(width: 8),
              Padding(padding: const EdgeInsets.only(bottom: 6),
                child: Text('₫', style: AppTextStyles.headingL.copyWith(color: Colors.white54))),
            ]),
            const SizedBox(height: 8),
          ]),
        )),

        // ── Bottom sheet ────────────────────────────────────────────
        Expanded(child: Container(
          decoration: const BoxDecoration(
            color: AppColors.background,
            borderRadius: BorderRadius.vertical(top: Radius.circular(AppTheme.radiusXL)),
          ),
          child: Column(children: [
            const SizedBox(height: 8),
            // Drag handle
            Container(width: 40, height: 4, decoration: BoxDecoration(color: AppColors.grey200, borderRadius: BorderRadius.circular(99))),
            const SizedBox(height: 16),

            // Meta row: date, category, note
            Padding(padding: const EdgeInsets.symmetric(horizontal: 20), child: Row(children: [
              _MetaChip(icon: Icons.calendar_today_rounded,
                label: DateFormat('dd/MM/yyyy').format(_selectedDate),
                onTap: () async {
                  final picked = await showDatePicker(
                    context: context, initialDate: _selectedDate,
                    firstDate: DateTime(2020), lastDate: DateTime.now().add(const Duration(days: 365)),
                    builder: (ctx, child) => Theme(
                      data: Theme.of(ctx).copyWith(
                        colorScheme: const ColorScheme.light(primary: AppColors.primary, onPrimary: AppColors.dark)),
                      child: child!,
                    ),
                  );
                  if (picked != null) setState(() => _selectedDate = picked);
                }),
              const SizedBox(width: 8),
              _MetaChip(icon: Icons.label_outline_rounded, label: _selectedCategory, onTap: () {}),
            ])),
            const SizedBox(height: 12),
            Padding(padding: const EdgeInsets.symmetric(horizontal: 20),
              child: TextField(
                controller: _noteCtrl,
                style: AppTextStyles.bodyM,
                decoration: InputDecoration(
                  hintText: 'Ghi chú (tùy chọn)...',
                  prefixIcon: const Icon(Icons.edit_note_rounded, color: AppColors.textSecondary, size: 22),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(AppTheme.radiusM), borderSide: const BorderSide(color: AppColors.border)),
                  enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(AppTheme.radiusM), borderSide: const BorderSide(color: AppColors.border)),
                  focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(AppTheme.radiusM), borderSide: const BorderSide(color: AppColors.primary, width: 2)),
                  filled: true, fillColor: AppColors.surface, contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                ),
              )),
            const Divider(height: 24),
            // Smart Numpad
            Expanded(child: _SmartNumpad(onInput: _numpadInput)),
          ]),
        )),
      ]),
    );
  }
}

class _MetaChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  const _MetaChip({required this.icon, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(99), boxShadow: AppTheme.shadowS),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 16, color: AppColors.textSecondary),
        const SizedBox(width: 6),
        Text(label, style: AppTextStyles.labelM),
      ]),
    ),
  );
}

// ── Smart Numpad ──────────────────────────────────────────────────────────────
class _SmartNumpad extends StatelessWidget {
  final ValueChanged<String> onInput;
  const _SmartNumpad({required this.onInput});

  static const _keys = [
    ['7', '8', '9', 'DEL'],
    ['4', '5', '6', ''],
    ['1', '2', '3', ''],
    ['', '0', '.', ''],
  ];

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      child: Column(children: _keys.map((row) => Expanded(child: Row(
        children: row.map((key) => Expanded(child: key.isEmpty
          ? const SizedBox.shrink()
          : _NumKey(label: key, onTap: () => onInput(key))
        )).toList(),
      ))).toList()),
    );
  }
}

class _NumKey extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  const _NumKey({required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final isDel = label == 'DEL';
    return Padding(
      padding: const EdgeInsets.all(4),
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          decoration: BoxDecoration(
            color: isDel ? AppColors.grey200 : AppColors.surface,
            borderRadius: BorderRadius.circular(AppTheme.radiusM),
            boxShadow: isDel ? null : AppTheme.shadowS,
          ),
          child: Center(child: isDel
            ? const Icon(Icons.backspace_outlined, size: 22, color: AppColors.grey600)
            : Text(label, style: AppTextStyles.headingL.copyWith(color: AppColors.textPrimary))
          ),
        ),
      ),
    );
  }
}
