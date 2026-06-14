import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared/i_whatsapp_api_client.dart';
import 'package:shared/validation_response_model.dart';
import 'package:shared/contact_model.dart';

class WhatsAppApiClient implements IWhatsAppApiClient {
  final String baseUrl;

  const WhatsAppApiClient({required this.baseUrl});

  @override
  Future<ValidationResponseModel> validateNumber(String phone) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/shop/validate'),
      headers: {
        'Content-Type': 'application/json',
        'X-Shop-Key': 'debug_shop_key',
      },
      body: jsonEncode({'to': phone}),
    );

    if (response.statusCode == 200) {
      final json = jsonDecode(response.body) as Map<String, dynamic>;
      return ValidationResponseModel.fromJson(json);
    } else {
      throw Exception('Server error: ${response.statusCode}');
    }
  }

  @override
  Future<List<ContactModel>> getContacts() async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/shop/contacts'),
      headers: {
        'X-Shop-Key': 'debug_shop_key',
      },
    );

    if (response.statusCode == 200) {
      final json = jsonDecode(response.body) as Map<String, dynamic>;
      final List<dynamic> contactsData = json['contacts'] ?? [];
      return contactsData.map((e) => ContactModel.fromJson(e as Map<String, dynamic>)).toList();
    } else {
      throw Exception('Server error fetching contacts: ${response.statusCode}');
    }
  }

  @override
  Future<bool> sendBulk(List<Map<String, String>> messages) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/shop/bulk'),
      headers: {
        'Content-Type': 'application/json',
        'X-Shop-Key': 'debug_shop_key',
      },
      body: jsonEncode({'messages': messages}),
    );

    if (response.statusCode == 202) {
      return true;
    } else {
      throw Exception('Server error sending bulk: ${response.statusCode}');
    }
  }
}
