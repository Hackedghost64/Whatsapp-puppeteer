/// Immutable DTO representing the response from the backend validation endpoint.
class ValidationResponseModel {
  final bool exists;
  final String? formattedJid;

  const ValidationResponseModel({
    required this.exists,
    this.formattedJid,
  });

  /// Defensive JSON deserializer
  factory ValidationResponseModel.fromJson(Map<String, dynamic> json) {
    // Explicitly parse the boolean value to prevent type mismatch crashes
    final bool parsedExists = json['exists'] == true || json['exists'] == 'true';
    
    // Safely extract the jid if present
    final String? parsedJid = json['jid']?.toString();

    return ValidationResponseModel(
      exists: parsedExists,
      formattedJid: parsedJid,
    );
  }
}
