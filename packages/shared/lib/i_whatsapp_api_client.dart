import 'validation_response_model.dart';
import 'contact_model.dart';

/// Abstract contract for the WhatsApp Suite backend API.
abstract class IWhatsAppApiClient {
  /// Validates whether the given [phone] number exists on WhatsApp natively.
  /// 
  /// The backend uses the native WPPConnect query to check WhatsApp servers directly.
  /// Will return a [ValidationResponseModel] indicating `exists` and the `formattedJid` if true.
  Future<ValidationResponseModel> validateNumber(String phone);
  
  /// Fetches all saved WhatsApp contacts from the backend.
  Future<List<ContactModel>> getContacts();

  /// Enqueues a bulk message payload.
  Future<bool> sendBulk(List<Map<String, String>> messages);
}
