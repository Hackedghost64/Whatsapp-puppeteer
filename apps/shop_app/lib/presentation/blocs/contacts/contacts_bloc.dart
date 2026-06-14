import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../data/repositories/shop_repository.dart';
import 'contacts_event.dart';
import 'contacts_state.dart';
import 'dart:developer' as developer;

class ContactsBloc extends Bloc<ContactsEvent, ContactsState> {
  final ShopRepository _repository;

  ContactsBloc({required ShopRepository repository})
      : _repository = repository,
        super(const ContactsInitial()) {
    on<LoadContactsRequested>(_onLoadContacts);
    on<SendBulkMessageRequested>(_onSendBulk);
  }

  Future<void> _onLoadContacts(
    LoadContactsRequested event,
    Emitter<ContactsState> emit,
  ) async {
    emit(const ContactsLoading());
    try {
      final contacts = await _repository.getContacts();
      emit(ContactsLoaded(contacts));
    } catch (e) {
      developer.log('[ERROR] ContactsBloc: Load failed - ${e.toString()}');
      emit(ContactsError(e.toString()));
    }
  }

  Future<void> _onSendBulk(
    SendBulkMessageRequested event,
    Emitter<ContactsState> emit,
  ) async {
    // Keep the current loaded state but just shoot the payload
    try {
      final messages = event.targetPhones.map((phone) {
        final cleanPhone = phone.replaceAll(RegExp(r'\D'), '');
        return {
          'to': cleanPhone,
          'message': event.message,
        };
      }).toList();
      
      await _repository.sendBulk(messages);
      developer.log('[TRACE] ContactsBloc: Bulk send queued.');
    } catch (e) {
      developer.log('[ERROR] ContactsBloc: Bulk send failed - ${e.toString()}');
      // In a real app we'd emit a specific "BulkSendFailure" state or similar.
    }
  }
}
