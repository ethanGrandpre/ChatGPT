#!/bin/bash
set -euo pipefail
source_dir=$(cd "$(dirname "$0")" && pwd)
out=${1:-"$source_dir/../../work/browser-build"}
command -v flutter >/dev/null || { echo 'Install Flutter first: https://docs.flutter.dev/get-started/install'; exit 1; }
flutter create --platforms=macos,ios,android --org com.ethangrandpre --project-name dock_browser "$out"
cp "$source_dir/pubspec.yaml" "$out/pubspec.yaml"
cp -R "$source_dir/lib/." "$out/lib/"
rm -f "$out/test/widget_test.dart"
mkdir -p "$out/test"
cp "$source_dir/test/"* "$out/test/"
python3 - "$out" <<'PY'
import pathlib,plistlib,sys
root=pathlib.Path(sys.argv[1])
for name in ['DebugProfile.entitlements','Release.entitlements']:
 p=root/'macos'/'Runner'/name
 d=plistlib.loads(p.read_bytes());d['com.apple.security.network.client']=True;p.write_bytes(plistlib.dumps(d))
p=root/'android/app/src/main/AndroidManifest.xml'
s=p.read_text();s=s.replace('<application','<uses-permission android:name="android.permission.INTERNET"/>\n    <application',1);p.write_text(s)
PY
cd "$out"
flutter pub get
printf '\nPrepared native project: %s\n' "$out"
