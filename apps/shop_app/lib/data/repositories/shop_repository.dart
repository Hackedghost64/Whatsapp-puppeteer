import 'package:shared/i_whatsapp_api_client.dart';
import 'package:shared/validation_response_model.dart';
import 'package:shared/contact_model.dart';

class ShopRepositoryException implements Exception {
  final String message;
  const ShopRepositoryException(this.message);

  @override
  String toString() => 'ShopRepositoryException: $message';
}

class ShopRepository {
  final IWhatsAppApiClient _apiClient;

  const ShopRepository({
    required IWhatsAppApiClient apiClient,
  }) : _apiClient = apiClient;

  Future<ValidationResponseModel> validateCustomerContact(String phone) async {
    try {
      return await _apiClient.validateNumber(phone);
    } catch (e) {
      throw ShopRepositoryException('Failed to validate contact: ${e.toString()}');
    }
  }

  Future<List<ContactModel>> getContacts() async {
    try {
      return await _apiClient.getContacts();
    } catch (e) {
      throw ShopRepositoryException('Failed to get contacts: ${e.toString()}');
    }
  }

  Future<bool> sendBulk(List<Map<String, String>> messages) async {
    try {
      return await _apiClient.sendBulk(messages);
    } catch (e) {
      throw ShopRepositoryException('Failed to send bulk messages: ${e.toString()}');
    }
  }
}
