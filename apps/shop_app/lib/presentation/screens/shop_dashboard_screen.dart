import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:shared/contact_model.dart';
import '../blocs/validation/validation_bloc.dart';
import '../blocs/validation/validation_event.dart';
import '../blocs/validation/validation_state.dart';
import '../blocs/contacts/contacts_bloc.dart';
import '../blocs/contacts/contacts_event.dart';
import '../blocs/contacts/contacts_state.dart';
import 'dart:developer' as developer;

class ShopDashboardScreen extends StatefulWidget {
  const ShopDashboardScreen({super.key});

  @override
  State<ShopDashboardScreen> createState() => _ShopDashboardScreenState();
}

class _ShopDashboardScreenState extends State<ShopDashboardScreen> {
  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Shop CRM'),
          bottom: const TabBar(
            tabs: [
              Tab(icon: Icon(Icons.group), text: 'Bulk (Saved Contacts)'),
              Tab(icon: Icon(Icons.person_add), text: 'Templates (Unsaved)'),
            ],
          ),
        ),
        body: const TabBarView(
          children: [
            _SavedContactsTab(),
            _UnsavedContactsTab(),
          ],
        ),
      ),
    );
  }
}

class _SavedContactsTab extends StatefulWidget {
  const _SavedContactsTab();

  @override
  State<_SavedContactsTab> createState() => _SavedContactsTabState();
}

class _SavedContactsTabState extends State<_SavedContactsTab> {
  final Set<String> _selectedPhones = {};
  final TextEditingController _msgController = TextEditingController();

  @override
  void dispose() {
    _msgController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Select contacts:', style: TextStyle(fontWeight: FontWeight.bold)),
              IconButton(
                icon: const Icon(Icons.refresh),
                onPressed: () {
                  context.read<ContactsBloc>().add(const LoadContactsRequested());
                },
                tooltip: 'Reload Contacts',
              ),
            ],
          ),
        ),
        Expanded(
          child: BlocBuilder<ContactsBloc, ContactsState>(
            builder: (context, state) {
              if (state is ContactsLoading) {
                return const Center(child: CircularProgressIndicator());
              } else if (state is ContactsError) {
                return Center(child: Text(state.error, style: const TextStyle(color: Colors.red)));
              } else if (state is ContactsLoaded) {
                if (state.contacts.isEmpty) {
                  return const Center(child: Text('No saved contacts found.'));
                }
                return ListView.builder(
                  itemCount: state.contacts.length,
                  itemBuilder: (context, index) {
                    final contact = state.contacts[index];
                    final isSelected = _selectedPhones.contains(contact.number);
                    return CheckboxListTile(
                      title: Text(contact.name),
                      subtitle: Text(contact.number),
                      value: isSelected,
                      onChanged: (bool? val) {
                        setState(() {
                          if (val == true) {
                            _selectedPhones.add(contact.number);
                          } else {
                            _selectedPhones.remove(contact.number);
                          }
                        });
                      },
                    );
                  },
                );
              }
              return const Center(child: Text('Initializing...'));
            },
          ),
        ),
        const Divider(),
        Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextField(
                controller: _msgController,
                decoration: const InputDecoration(
                  labelText: 'Bulk Message',
                  border: OutlineInputBorder(),
                ),
                maxLines: 3,
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _selectedPhones.isEmpty
                    ? null
                    : () {
                        if (_msgController.text.trim().isEmpty) return;
                        context.read<ContactsBloc>().add(SendBulkMessageRequested(
                              targetPhones: _selectedPhones.toList(),
                              message: _msgController.text.trim(),
                            ));
                        developer.log('[INFO] Bulk messages queued!');
                        _msgController.clear();
                        setState(() => _selectedPhones.clear());
                      },
                child: Text('Send to ${_selectedPhones.length} Contacts'),
              ),
            ],
          ),
        )
      ],
    );
  }
}

class _UnsavedContactsTab extends StatefulWidget {
  const _UnsavedContactsTab();

  @override
  State<_UnsavedContactsTab> createState() => _UnsavedContactsTabState();
}

class _UnsavedContactsTabState extends State<_UnsavedContactsTab> {
  final TextEditingController _phoneController = TextEditingController();
  final TextEditingController _msgController = TextEditingController();

  final Map<String, String> _templates = {
    'Review': 'Hello! Drop a review for our shop here, humein aapke feedback ka intezaar rahega!',
    'Thanks': 'Namaste! Thank you for purchasing from our shop. Umeed hai aapko product pasand aaya hoga!',
  };

  @override
  void dispose() {
    _phoneController.dispose();
    _msgController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: BlocConsumer<ValidationBloc, ValidationState>(
        listener: (context, state) {
          if (state is ValidationFailure) {
            developer.log('[ERROR] UI: Validation failed: ${state.error}');
          }
        },
        builder: (context, state) {
          final isLoading = state is ValidationLoading;
          Color? borderColor;
          String? helperText;

          if (state is ValidationSuccess) {
            if (state.exists) {
              borderColor = Colors.green;
            } else {
              borderColor = Colors.red;
              helperText = "Number not registered on WhatsApp";
            }
          }

          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextField(
                controller: _phoneController,
                keyboardType: TextInputType.phone,
                enabled: !isLoading,
                decoration: InputDecoration(
                  labelText: 'Customer Phone Number',
                  helperText: helperText,
                  helperStyle: const TextStyle(color: Colors.red),
                  border: const OutlineInputBorder(),
                  enabledBorder: borderColor != null
                      ? OutlineInputBorder(borderSide: BorderSide(color: borderColor, width: 2))
                      : null,
                  focusedBorder: borderColor != null
                      ? OutlineInputBorder(borderSide: BorderSide(color: borderColor, width: 2))
                      : null,
                ),
              ),
              const SizedBox(height: 16),
              if (isLoading)
                const Center(child: CircularProgressIndicator())
              else
                ElevatedButton(
                  onPressed: () {
                    final text = _phoneController.text.trim();
                    if (text.isNotEmpty) {
                      context.read<ValidationBloc>().add(ValidatePhoneRequested(text));
                    }
                  },
                  child: const Text('Verify Number'),
                ),
              const Divider(height: 40),
              Wrap(
                spacing: 8,
                children: _templates.entries.map((e) {
                  return ActionChip(
                    label: Text(e.key),
                    onPressed: () {
                      _msgController.text = e.value;
                    },
                  );
                }).toList(),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _msgController,
                decoration: const InputDecoration(
                  labelText: 'Template Message',
                  border: OutlineInputBorder(),
                ),
                maxLines: 3,
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: (state is ValidationSuccess && state.exists)
                    ? () {
                        if (_msgController.text.trim().isEmpty) return;
                        context.read<ContactsBloc>().add(SendBulkMessageRequested(
                              targetPhones: [_phoneController.text.trim()],
                              message: _msgController.text.trim(),
                            ));
                        developer.log('[INFO] Template message queued!');
                      }
                    : null,
                child: const Text('Dispatch Template'),
              ),
            ],
          );
        },
      ),
    );
  }
}
