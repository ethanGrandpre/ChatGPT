import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'navigation.dart';

void main() { WidgetsFlutterBinding.ensureInitialized(); runApp(const BrowserApp()); }
class BrowserTab {
  BrowserTab(this.id);
  final int id;
  String title = 'New tab';
  String? url;
  InAppWebViewController? controller;
  bool back = false, forward = false;
  double progress = 1;
  String? error;
}
class BrowserApp extends StatefulWidget {
  const BrowserApp({super.key});
  @override State<BrowserApp> createState() => _BrowserAppState();
}
class _BrowserAppState extends State<BrowserApp> {
  final tabs = <BrowserTab>[BrowserTab(0)];
  final messenger = GlobalKey<ScaffoldMessengerState>();
  final address = TextEditingController();
  final addressFocus = FocusNode();
  int active = 0, nextId = 1;
  bool dark = false, ready = false;
  List<Map<String, String>> bookmarks = [];
  SharedPreferences? prefs;
  BrowserTab get current => tabs[active];
  @override void initState() { super.initState(); restore(); }
  Future<void> restore() async {
    prefs = await SharedPreferences.getInstance();
    try {
      final data = jsonDecode(prefs!.getString('bookmarks') ?? '[]') as List;
      bookmarks = data.map((e) => Map<String, String>.from(e as Map)).where((e) => allowedNavigation(Uri.tryParse(e['url'] ?? ''))).toList();
    } catch (_) { bookmarks = []; }
    if (mounted) setState(() { dark = prefs!.getBool('dark') ?? false; ready = true; });
  }
  void save() { prefs?.setBool('dark', dark); prefs?.setString('bookmarks', jsonEncode(bookmarks)); }
  @override void dispose() { address.dispose(); addressFocus.dispose(); super.dispose(); }
  void select(int index) { setState(() { active = index; address.text = current.url ?? ''; }); }
  void addTab() { setState(() { tabs.add(BrowserTab(nextId++)); active = tabs.length - 1; address.clear(); }); }
  void closeTab(int index) {
    setState(() {
      final id = current.id;
      tabs.removeAt(index);
      if (tabs.isEmpty) tabs.add(BrowserTab(nextId++));
      final selected = tabs.indexWhere((t) => t.id == id);
      active = selected < 0 ? (index < tabs.length ? index : tabs.length - 1) : selected;
      address.text = current.url ?? '';
    });
  }
  Future<void> navigate(String text) async {
    if (text.trim().isEmpty) return;
    try {
      final url = destination(text);
      final tab = current;
      setState(() { tab.url = url.toString(); tab.title = url.host; tab.error = null; });
      address.text = url.toString(); addressFocus.unfocus();
      await tab.controller?.loadUrl(urlRequest: URLRequest(url: WebUri(url.toString())));
    } on FormatException catch (e) { if (mounted) messenger.currentState?.showSnackBar(SnackBar(content: Text(e.message))); }
  }
  Future<void> update(BrowserTab tab, InAppWebViewController c, WebUri? url) async {
    if (tab.url == null && (url == null || url.toString() == 'about:blank')) return;
    final back = await c.canGoBack(), forward = await c.canGoForward();
    if (!mounted || !tabs.contains(tab)) return;
    setState(() { tab.url = url?.toString() ?? tab.url; tab.back = back; tab.forward = forward; if (tab == current && !addressFocus.hasFocus) address.text = tab.url ?? ''; });
  }
  void bookmark() {
    if (current.url == null) return;
    setState(() {
      final exists = bookmarks.any((b) => b['url'] == current.url);
      if (exists) { bookmarks.removeWhere((b) => b['url'] == current.url); }
      else { bookmarks.add({'title': current.title, 'url': current.url!}); }
    }); save();
  }
  void showBookmarks(BuildContext ctx) {
    showModalBottomSheet(context: ctx, builder: (sheet) => StatefulBuilder(builder: (context, refresh) => SafeArea(child: SizedBox(height: 400, child: Column(children: [
      const ListTile(title: Text('Bookmarks')),
      if (bookmarks.isEmpty) const Padding(padding: EdgeInsets.all(24), child: Text('Bookmark a page using the star in the toolbar.')),
      Expanded(child: ListView.builder(itemCount: bookmarks.length, itemBuilder: (_, i) => ListTile(
        title: Text(bookmarks[i]['title']!, maxLines: 1, overflow: TextOverflow.ellipsis),
        subtitle: Text(bookmarks[i]['url']!, maxLines: 1, overflow: TextOverflow.ellipsis),
        onTap: () { final url = bookmarks[i]['url']!; Navigator.pop(sheet); navigate(url); },
        trailing: IconButton(tooltip: 'Remove bookmark', icon: const Icon(Icons.close, size: 18), onPressed: () { setState(() => bookmarks.removeAt(i)); save(); refresh(() {}); }),
      )))
    ])))));
  }
  Widget tabView(BrowserTab tab) => Stack(key: ValueKey('tab-${tab.id}'), children: [
    Positioned.fill(child: InAppWebView(
      key: ValueKey(tab.id),
      initialSettings: InAppWebViewSettings(javaScriptEnabled: true, useShouldOverrideUrlLoading: true, supportMultipleWindows: false, javaScriptCanOpenWindowsAutomatically: false, allowFileAccess: false, allowContentAccess: false),
      onWebViewCreated: (c) { tab.controller = c; if (tab.url != null) c.loadUrl(urlRequest: URLRequest(url: WebUri(tab.url!))); },
      shouldOverrideUrlLoading: (_, action) async => allowedNavigation(action.request.url) ? NavigationActionPolicy.ALLOW : NavigationActionPolicy.CANCEL,
      onPermissionRequest: (_, request) async => PermissionResponse(resources: request.resources, action: PermissionResponseAction.DENY),
      onLoadStart: (c, url) { if (mounted) setState(() { tab.error = null; tab.progress = 0; }); update(tab, c, url); },
      onLoadStop: (c, url) { if (mounted) setState(() => tab.progress = 1); update(tab, c, url); },
      onUpdateVisitedHistory: (c, url, _) => update(tab, c, url),
      onTitleChanged: (_, title) { if (mounted && tabs.contains(tab) && tab.url != null) setState(() => tab.title = title?.isNotEmpty == true ? title! : 'Untitled'); },
      onProgressChanged: (_, progress) { if (mounted) setState(() => tab.progress = progress / 100); },
      onReceivedError: (_, request, error) { if (request.isForMainFrame == true && mounted) setState(() { tab.error = error.description; tab.progress = 1; }); },
    )),
    if (tab.url == null) Positioned.fill(child: ColoredBox(color: dark ? Colors.black : Colors.white, child: Center(child: Padding(padding: const EdgeInsets.all(32), child: Column(mainAxisSize: MainAxisSize.min, children: [
      const Icon(Icons.public, size: 42), const SizedBox(height: 20), const Text('A little room to explore.', style: TextStyle(fontSize: 25, fontWeight: FontWeight.w500)),
      const SizedBox(height: 12), const Text('Enter a website or search in the address bar.'), const SizedBox(height: 28),
      Wrap(spacing: 10, runSpacing: 10, children: ['https://www.wikipedia.org', 'https://www.google.com'].map((url) => OutlinedButton(onPressed: () => navigate(url), child: Text(Uri.parse(url).host.replaceFirst('www.', '')))).toList())
    ]))))),
    if (tab.error != null) Positioned.fill(child: ColoredBox(color: dark ? Colors.black : Colors.white, child: Center(child: Padding(padding: const EdgeInsets.all(32), child: Column(mainAxisSize: MainAxisSize.min, children: [const Icon(Icons.cloud_off_outlined, size: 36), const SizedBox(height: 16), const Text('This page could not be loaded.'), const SizedBox(height: 8), Text(tab.error!, textAlign: TextAlign.center), TextButton(onPressed: () => tab.controller?.reload(), child: const Text('Try again'))])))))
  ]);
  @override Widget build(BuildContext context) => MaterialApp(
    scaffoldMessengerKey: messenger, debugShowCheckedModeBanner: false, title: 'Dock Browser', themeMode: dark ? ThemeMode.dark : ThemeMode.light,
    theme: ThemeData(useMaterial3: true, colorScheme: ColorScheme.fromSeed(seedColor: Colors.grey), scaffoldBackgroundColor: Colors.white),
    darkTheme: ThemeData(useMaterial3: true, brightness: Brightness.dark, colorScheme: ColorScheme.fromSeed(seedColor: Colors.grey, brightness: Brightness.dark), scaffoldBackgroundColor: Colors.black),
    home: Builder(builder: (ctx) => Scaffold(body: SafeArea(child: !ready ? const Center(child: CircularProgressIndicator()) : Column(children: [
      SizedBox(height: 44, child: Row(children: [const Padding(padding: EdgeInsets.symmetric(horizontal: 14), child: Text('dock', style: TextStyle(fontWeight: FontWeight.bold))), Expanded(child: ListView.builder(scrollDirection: Axis.horizontal, itemCount: tabs.length, itemBuilder: (_, i) => Container(width: 170, margin: const EdgeInsets.all(3), decoration: BoxDecoration(border: Border.all(color: i == active ? Colors.grey : Colors.transparent), borderRadius: BorderRadius.circular(7)), child: Row(children: [Expanded(child: TextButton(onPressed: () => select(i), child: Text(tabs[i].title, maxLines: 1, overflow: TextOverflow.ellipsis))), IconButton(tooltip: 'Close tab', icon: const Icon(Icons.close, size: 14), onPressed: () => closeTab(i))])))), IconButton(tooltip: 'New tab', icon: const Icon(Icons.add), onPressed: addTab)])),
      Padding(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5), child: Row(children: [
        IconButton(tooltip: 'Back', onPressed: current.back ? () => current.controller?.goBack() : null, icon: const Icon(Icons.arrow_back, size: 20)),
        if (MediaQuery.sizeOf(ctx).width > 500) IconButton(tooltip: 'Forward', onPressed: current.forward ? () => current.controller?.goForward() : null, icon: const Icon(Icons.arrow_forward, size: 20)),
        IconButton(tooltip: current.progress < 1 ? 'Stop loading' : 'Reload', icon: Icon(current.progress < 1 ? Icons.close : Icons.refresh, size: 20), onPressed: current.url == null ? null : () => current.progress < 1 ? current.controller?.stopLoading() : current.controller?.reload()),
        Expanded(child: TextField(controller: address, focusNode: addressFocus, autocorrect: false, enableSuggestions: false, textInputAction: TextInputAction.go, keyboardType: TextInputType.url, decoration: const InputDecoration(isDense: true, hintText: 'Search or enter address', border: OutlineInputBorder()), onSubmitted: navigate)),
        IconButton(tooltip: 'Bookmark page', onPressed: current.url == null ? null : bookmark, icon: Icon(bookmarks.any((b) => b['url'] == current.url) ? Icons.star : Icons.star_border, size: 20)),
        PopupMenuButton<String>(tooltip: 'Browser menu', onSelected: (v) { if (v == 'theme') { setState(() => dark = !dark); save(); } if (v == 'bookmarks') showBookmarks(ctx); if (v == 'home') addTab(); }, itemBuilder: (_) => [const PopupMenuItem(value: 'home', child: Text('New tab')), const PopupMenuItem(value: 'bookmarks', child: Text('Bookmarks')), PopupMenuItem(value: 'theme', child: Text(dark ? 'Light mode' : 'Dark mode'))])
      ])),
      SizedBox(height: 2, child: current.progress < 1 ? LinearProgressIndicator(value: current.progress) : null),
      Expanded(child: IndexedStack(index: active, children: tabs.map(tabView).toList()))
    ]))))
  );
}
