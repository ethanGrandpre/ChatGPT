# Dock Browser — native prototype

A personal browser implemented in Flutter with native WebViews: WKWebView on macOS/iOS and Android System WebView on Android. It uses those installed engines, not Google's Chrome application or a newly authored browser engine.

Features: independent tabs that preserve their WebViews when switching, close/new tab, address/search bar, Google search, back/forward, reload/stop, load progress and errors, saved bookmarks with removal, and saved light/dark preference. Permissions default to denied; unsupported external schemes and file/data/javascript navigation are blocked. HTTPS is the intended browsing mode; platform cleartext restrictions remain enabled. Website authentication compatibility depends on the native WebView. This prototype does not yet include downloads, extensions, private mode, password management, cookie/history controls, or sync. Tabs are held in memory; bookmarks/theme persist on the device. It does not claim production browser security or privacy isolation between tabs.

## Build
Install Flutter stable, Xcode for Apple targets, or Android Studio for Android. From the repository root:

```
bash native/browser/prepare.sh
cd work/browser-build
flutter analyze --no-fatal-infos
flutter test
flutter run -d macos
```

Use `flutter build macos --release` for a Mac app; `flutter build apk --debug` for a test Android APK. For iPhone, open the generated `ios/Runner.xcworkspace` in Xcode, choose your development team and connected device, and run with Flutter/Xcode. Installing on an iPhone requires Apple signing and device provisioning. The iOS target has not been device-tested.

GitHub Actions → Build native browser automatically attempts Mac and Android builds and publishes downloadable artifacts after successful builds. Mac artifacts are unsigned/not notarized; Android artifacts use a debug signing key. They are development builds, not App Store or Play Store releases. Never disable system-wide application security to install them.

The private hub links to the project page. Installing a native app is separate from opening that page. The Cloudflare login controls the hub and source downloads, not arbitrary browsing in an installed native app.
