import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:budgetbee/main.dart';

void main() {
  testWidgets('BudgetBee app boots correctly', (WidgetTester tester) async {
    await tester.pumpWidget(
      const ProviderScope(child: BudgetBeeApp()),
    );
    await tester.pump(const Duration(seconds: 1));
    // App should start without crashing
    expect(find.byType(ProviderScope), findsOneWidget);
  });
}
