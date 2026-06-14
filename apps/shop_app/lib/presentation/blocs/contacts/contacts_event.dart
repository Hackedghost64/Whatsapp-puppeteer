import 'package:equatable/equatable.dart';

abstract class ContactsEvent extends Equatable {
  const ContactsEvent();

  @override
  List<Object?> get props => [];
}

class LoadContactsRequested extends ContactsEvent {
  const LoadContactsRequested();
}

class SendBulkMessageRequested extends ContactsEvent {
  final List<String> targetPhones;
  final String message;

  const SendBulkMessageRequested({
    required this.targetPhones,
    required this.message,
  });

  @override
  List<Object?> get props => [targetPhones, message];
}
