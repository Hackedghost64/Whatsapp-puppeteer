import 'package:equatable/equatable.dart';

abstract class ValidationState extends Equatable {
  const ValidationState();

  @override
  List<Object?> get props => [];
}

class ValidationInitial extends ValidationState {
  const ValidationInitial();
}

class ValidationLoading extends ValidationState {
  const ValidationLoading();
}

class ValidationSuccess extends ValidationState {
  final bool exists;
  final String? jid;

  const ValidationSuccess({
    required this.exists,
    this.jid,
  });

  @override
  List<Object?> get props => [exists, jid];
}

class ValidationFailure extends ValidationState {
  final String error;

  const ValidationFailure(this.error);

  @override
  List<Object?> get props => [error];
}
