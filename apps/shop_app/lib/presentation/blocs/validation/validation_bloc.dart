import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:shared/validation_response_model.dart';
import '../../../data/repositories/shop_repository.dart';
import 'validation_event.dart';
import 'validation_state.dart';
import 'dart:developer' as developer;

class ValidationBloc extends Bloc<ValidationEvent, ValidationState> {
  final ShopRepository _repository;

  ValidationBloc({
    required ShopRepository repository,
  })  : _repository = repository,
        super(const ValidationInitial()) {
    on<ValidatePhoneRequested>(_onValidatePhoneRequested);
  }

  Future<void> _onValidatePhoneRequested(
    ValidatePhoneRequested event,
    Emitter<ValidationState> emit,
  ) async {
    developer.log('[TRACE] ValidationBloc: ValidatePhoneRequested for ${event.phoneNumber}');
    emit(const ValidationLoading());
    try {
      final ValidationResponseModel response = await _repository.validateCustomerContact(event.phoneNumber);
      developer.log('[TRACE] ValidationBloc: ValidationSuccess (exists: ${response.exists}, jid: ${response.formattedJid})');
      emit(ValidationSuccess(exists: response.exists, jid: response.formattedJid));
    } catch (e) {
      developer.log('[ERROR] ValidationBloc: ValidationFailure - ${e.toString()}');
      emit(ValidationFailure(e.toString()));
    }
  }
}
