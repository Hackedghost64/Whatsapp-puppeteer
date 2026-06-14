import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'data/clients/whatsapp_api_client.dart';
import 'data/repositories/shop_repository.dart';
import 'presentation/blocs/validation/validation_bloc.dart';
import 'presentation/blocs/contacts/contacts_bloc.dart';
import 'presentation/blocs/contacts/contacts_event.dart';
import 'presentation/screens/shop_dashboard_screen.dart';
import 'core/config/api_config.dart';
import 'dart:io';

class MyHttpOverrides extends HttpOverrides {
  @override
  HttpClient createHttpClient(SecurityContext? context) {
    return super.createHttpClient(context)
      ..badCertificateCallback = (X509Certificate cert, String host, int port) => true;
  }
}

void main() {
  HttpOverrides.global = MyHttpOverrides();
  runApp(const ShopApp());
}

class ShopApp extends StatelessWidget {
  const ShopApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiRepositoryProvider(
      providers: [
        RepositoryProvider<WhatsAppApiClient>(
          create: (context) => const WhatsAppApiClient(baseUrl: ApiConfig.baseUrl),
        ),
        RepositoryProvider<ShopRepository>(
          create: (context) => ShopRepository(
            apiClient: context.read<WhatsAppApiClient>(),
          ),
        ),
      ],
      child: MaterialApp(
        title: 'WhatsApp Suite - Shop',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(seedColor: Colors.teal),
          useMaterial3: true,
        ),
        home: MultiBlocProvider(
          providers: [
            BlocProvider(
              create: (context) => ValidationBloc(
                repository: context.read<ShopRepository>(),
              ),
            ),
            BlocProvider(
              create: (context) => ContactsBloc(
                repository: context.read<ShopRepository>(),
              )..add(const LoadContactsRequested()), // Auto-load on boot
            ),
          ],
          child: const ShopDashboardScreen(),
        ),
      ),
    );
  }
}
