import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:intl/intl.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_text_styles.dart';
import '../../../../core/theme/app_theme.dart';
import '../../transaction/data/transaction_repository.dart';

class ReportsPage extends ConsumerStatefulWidget {
  const ReportsPage({super.key});
  @override
  ConsumerState<ReportsPage> createState() => _ReportsPageState();
}

class _ReportsPageState extends ConsumerState<ReportsPage>
    with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;
  int _periodIndex = 1; // 0=Tuần, 1=Tháng, 2=Năm

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final statsAsync = ref.watch(monthStatsProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            // ── Header ────────────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                child: Row(
                  children: [
                    Text('Báo cáo', style: AppTextStyles.headingXL),
                    const Spacer(),
                    GestureDetector(
                      onTap: () {},
                      child: Container(
                        width: 44, height: 44,
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          shape: BoxShape.circle,
                          boxShadow: AppTheme.shadowS,
                        ),
                        child: const Icon(Icons.share_rounded, size: 22),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 20)),

            // ── Period selector ─────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Container(
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: AppColors.dark,
                    borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                  ),
                  child: Row(
                    children: List.generate(3, (i) {
                      final labels = ['Tuần', 'Tháng', 'Năm'];
                      final active = _periodIndex == i;
                      return Expanded(
                        child: GestureDetector(
                          onTap: () {
                            HapticFeedback.selectionClick();
                            setState(() => _periodIndex = i);
                          },
                          behavior: HitTestBehavior.opaque,
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 250),
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            decoration: BoxDecoration(
                              color: active ? AppColors.primary : Colors.transparent,
                              borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                            ),
                            child: Text(
                              labels[i],
                              textAlign: TextAlign.center,
                              style: AppTextStyles.labelL.copyWith(
                                color: active ? AppColors.dark : Colors.white70,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ),
                      );
                    }),
                  ),
                ),
              ),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 24)),

            // ── Summary stats ───────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: statsAsync.when(
                  loading: () => const SizedBox(
                      height: 100, child: Center(child: CircularProgressIndicator(color: AppColors.primary))),
                  error: (_, __) => const SizedBox.shrink(),
                  data: (s) => _SummaryGrid(
                    income: s['income'] ?? 0,
                    expense: s['expense'] ?? 0,
                    balance: s['balance'] ?? 0,
                  ),
                ),
              ),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 24)),

            // ── Line Chart ─────────────────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: _LineChartCard(),
              ),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 24)),

            // ── Pie Chart Categories ───────────────────────────────
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: _CategoryBreakdownCard(),
              ),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 100)),
          ],
        ),
      ),
    );
  }
}

// ── Summary Grid 3 cards ──────────────────────────────────────────────────────
class _SummaryGrid extends StatelessWidget {
  final double income, expense, balance;
  const _SummaryGrid({required this.income, required this.expense, required this.balance});

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat.compactCurrency(locale: 'vi_VN', symbol: '');
    return Column(
      children: [
        // Net balance — big card
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft, end: Alignment.bottomRight,
              colors: [AppColors.gradientStart, AppColors.gradientEnd],
            ),
            borderRadius: BorderRadius.circular(AppTheme.radiusXL),
            boxShadow: AppTheme.shadowGreen,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Số dư ròng tháng này',
                  style: AppTextStyles.bodyM.copyWith(color: AppColors.dark.withValues(alpha: 0.7))),
              const SizedBox(height: 8),
              Text(
                '${fmt.format(balance)} ₫',
                style: AppTextStyles.moneyXL.copyWith(color: AppColors.dark),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        // Income/Expense pair
        Row(
          children: [
            Expanded(
              child: _SmallStatCard(
                icon: Icons.arrow_downward_rounded,
                color: AppColors.income,
                label: 'Thu nhập',
                value: '${fmt.format(income)} ₫',
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _SmallStatCard(
                icon: Icons.arrow_upward_rounded,
                color: AppColors.expense,
                label: 'Chi tiêu',
                value: '${fmt.format(expense)} ₫',
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _SmallStatCard extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String label;
  final String value;
  const _SmallStatCard({
    required this.icon, required this.color,
    required this.label, required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTheme.radiusL),
        boxShadow: AppTheme.shadowS,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 30, height: 30,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: color, size: 16),
          ),
          const SizedBox(height: 10),
          Text(label, style: AppTextStyles.bodyS),
          const SizedBox(height: 2),
          Text(value, style: AppTextStyles.moneyS.copyWith(color: color)),
        ],
      ),
    );
  }
}

// ── Line Chart — Balance Trend ────────────────────────────────────────────────
class _LineChartCard extends StatelessWidget {
  // Mock data — replace with actual API call in production
  static final _spots = [
    const FlSpot(0, 3),
    const FlSpot(1, 4),
    const FlSpot(2, 3.5),
    const FlSpot(3, 5),
    const FlSpot(4, 4),
    const FlSpot(5, 6),
    const FlSpot(6, 5.5),
  ];

  static const _labels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTheme.radiusL),
        boxShadow: AppTheme.shadowS,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text('Xu hướng số dư', style: AppTextStyles.headingM),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.income.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(AppTheme.radiusFull),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.trending_up_rounded,
                        size: 14, color: AppColors.income),
                    const SizedBox(width: 4),
                    Text('+25%',
                        style: AppTextStyles.caption.copyWith(
                            color: AppColors.income, fontWeight: FontWeight.w700)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          SizedBox(
            height: 180,
            child: LineChart(
              LineChartData(
                gridData: const FlGridData(show: false),
                titlesData: FlTitlesData(
                  leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 30,
                      getTitlesWidget: (value, _) {
                        final i = value.toInt();
                        if (i < 0 || i >= _labels.length) return const SizedBox();
                        return Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text(_labels[i],
                              style: AppTextStyles.caption),
                        );
                      },
                    ),
                  ),
                ),
                borderData: FlBorderData(show: false),
                lineTouchData: LineTouchData(
                  touchTooltipData: LineTouchTooltipData(
                    getTooltipColor: (_) => AppColors.dark,
                    getTooltipItems: (spots) => spots.map((s) =>
                      LineTooltipItem(
                        '${s.y.toStringAsFixed(1)}M ₫',
                        AppTextStyles.labelL.copyWith(color: AppColors.primary),
                      )
                    ).toList(),
                  ),
                ),
                lineBarsData: [
                  LineChartBarData(
                    spots: _spots,
                    isCurved: true,
                    curveSmoothness: 0.35,
                    color: AppColors.primary,
                    barWidth: 3,
                    isStrokeCapRound: true,
                    dotData: FlDotData(
                      show: true,
                      getDotPainter: (spot, _, __, ___) => FlDotCirclePainter(
                        radius: 4,
                        color: AppColors.primary,
                        strokeWidth: 2,
                        strokeColor: AppColors.surface,
                      ),
                    ),
                    belowBarData: BarAreaData(
                      show: true,
                      gradient: LinearGradient(
                        colors: [
                          AppColors.primary.withValues(alpha: 0.4),
                          AppColors.primary.withValues(alpha: 0.0),
                        ],
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Pie Chart — Category Breakdown ───────────────────────────────────────────
class _CategoryBreakdownCard extends StatefulWidget {
  @override
  State<_CategoryBreakdownCard> createState() => _CategoryBreakdownCardState();
}

class _CategoryBreakdownCardState extends State<_CategoryBreakdownCard> {
  int _touchedIdx = -1;

  // Mock data — replace with real API
  static final _categories = [
    (label: 'Ăn uống', value: 35.0, color: const Color(0xFFBDE83E)),
    (label: 'Di chuyển', value: 25.0, color: const Color(0xFF3B82F6)),
    (label: 'Mua sắm', value: 18.0, color: const Color(0xFFF59E0B)),
    (label: 'Giải trí', value: 12.0, color: const Color(0xFFEC4899)),
    (label: 'Khác', value: 10.0, color: const Color(0xFF9CA3AF)),
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppTheme.radiusL),
        boxShadow: AppTheme.shadowS,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Chi tiêu theo danh mục', style: AppTextStyles.headingM),
          const SizedBox(height: 20),
          Row(
            children: [
              SizedBox(
                width: 140, height: 140,
                child: PieChart(
                  PieChartData(
                    pieTouchData: PieTouchData(
                      touchCallback: (event, response) {
                        setState(() {
                          _touchedIdx = response?.touchedSection?.touchedSectionIndex ?? -1;
                        });
                      },
                    ),
                    borderData: FlBorderData(show: false),
                    sectionsSpace: 2,
                    centerSpaceRadius: 38,
                    sections: List.generate(_categories.length, (i) {
                      final c = _categories[i];
                      final isTouched = i == _touchedIdx;
                      return PieChartSectionData(
                        color: c.color,
                        value: c.value,
                        title: isTouched ? '${c.value.toInt()}%' : '',
                        radius: isTouched ? 32 : 26,
                        titleStyle: AppTextStyles.labelM.copyWith(
                          color: Colors.white, fontWeight: FontWeight.w800,
                        ),
                      );
                    }),
                  ),
                ),
              ),
              const SizedBox(width: 16),
              // Legend
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: _categories.map((c) => Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Row(
                      children: [
                        Container(
                          width: 10, height: 10,
                          decoration: BoxDecoration(
                            color: c.color,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(c.label, style: AppTextStyles.bodyS),
                        ),
                        Text(
                          '${c.value.toInt()}%',
                          style: AppTextStyles.labelM.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  )).toList(),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
