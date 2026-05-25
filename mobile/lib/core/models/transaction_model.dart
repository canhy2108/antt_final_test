import 'package:flutter/material.dart';

enum TransactionType { income, expense, transfer }

class TransactionModel {
  final String id;
  final String name;
  final double amount;
  final TransactionType type;
  final String categoryName;
  final String categoryIcon;
  final Color categoryColor;
  final String accountName;
  final DateTime date;
  final String? note;

  const TransactionModel({
    required this.id,
    required this.name,
    required this.amount,
    required this.type,
    required this.categoryName,
    required this.categoryIcon,
    required this.categoryColor,
    required this.accountName,
    required this.date,
    this.note,
  });

  bool get isExpense => type == TransactionType.expense;
  bool get isIncome => type == TransactionType.income;

  factory TransactionModel.fromJson(Map<String, dynamic> json) {
    return TransactionModel(
      id: json['id'].toString(),
      name: json['name'] ?? '',
      amount: (json['amount'] as num).abs().toDouble(),
      type: _parseType(json['type']),
      categoryName: json['category']?['name'] ?? 'Khác',
      categoryIcon: json['category']?['icon'] ?? 'category',
      categoryColor:
          Color(int.tryParse(json['category']?['color'] ?? '0xFF9CA3AF') ??
              0xFF9CA3AF),
      accountName: json['account']?['name'] ?? '',
      date: DateTime.tryParse(json['date'] ?? '') ?? DateTime.now(),
      note: json['description'],
    );
  }

  static TransactionType _parseType(String? type) {
    switch (type) {
      case 'income':
        return TransactionType.income;
      case 'transfer':
        return TransactionType.transfer;
      default:
        return TransactionType.expense;
    }
  }
}

class AccountModel {
  final String id;
  final String name;
  final double balance;
  final String type;
  final String currencySymbol;
  final Color color;

  const AccountModel({
    required this.id,
    required this.name,
    required this.balance,
    required this.type,
    required this.currencySymbol,
    this.color = const Color(0xFF6366F1),
  });

  factory AccountModel.fromJson(Map<String, dynamic> json) {
    return AccountModel(
      id: json['id'].toString(),
      name: json['name'] ?? '',
      balance: (json['balance'] as num?)?.toDouble() ?? 0,
      type: json['type']?['name'] ?? 'Cash',
      currencySymbol: json['currency_symbol'] ?? '₫',
      color: Color(int.tryParse(json['color'] ?? '0xFF6366F1') ?? 0xFF6366F1),
    );
  }
}
