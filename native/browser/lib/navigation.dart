Uri destination(String input) {
  final text = input.trim();
  final uri = Uri.tryParse(text);
  if (uri != null && ['http', 'https'].contains(uri.scheme) && uri.host.isNotEmpty) return uri;
  if (uri != null && uri.hasScheme && !RegExp(r'^[a-zA-Z0-9.-]+:\d+').hasMatch(text)) {
    throw const FormatException('Only http and https addresses can be opened.');
  }
  if (!text.contains(RegExp(r'\s')) && (text.contains('.') || text.startsWith('localhost'))) {
    final address = Uri.tryParse('https://$text');
    if (address != null && address.host.isNotEmpty) return address;
  }
  return Uri.https('www.google.com', '/search', {'q': text});
}
bool allowedNavigation(Uri? uri) => uri != null && (['http', 'https'].contains(uri.scheme) || uri.toString() == 'about:blank');
