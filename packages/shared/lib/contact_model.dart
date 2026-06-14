class ContactModel {
  final String id;
  final String name;
  final String number;

  const ContactModel({
    required this.id,
    required this.name,
    required this.number,
  });

  factory ContactModel.fromJson(Map<String, dynamic> json) {
    return ContactModel(
      id: json['id'] as String,
      name: json['name'] as String,
      number: json['number'] as String,
    );
  }
}
