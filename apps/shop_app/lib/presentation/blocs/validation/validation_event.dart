import 'package:equatable/equatable.dart';

abstract class ValidationEvent extends Equatable {
  const ValidationEvent();

  @override
  List<Object> get props => [];
}

class ValidatePhoneRequested extends ValidationEvent {
  final String phoneNumber;

  const ValidatePhoneRequested(this.phoneNumber);

  @override
  List<Object> get props => [phoneNumber];
}
