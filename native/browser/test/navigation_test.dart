import 'package:flutter_test/flutter_test.dart';
import 'package:dock_browser/navigation.dart';
void main() {
 test('addresses and search queries', () { expect(destination('example.com').toString(), 'https://example.com'); expect(destination('https://example.com/a').host, 'example.com'); expect(destination('hello world').queryParameters['q'], 'hello world'); });
 test('dangerous schemes stay out of the WebView', () { for(final value in ['javascript:alert(1)', 'file:///etc/passwd', 'data:text/html,test']) { expect(() => destination(value), throwsFormatException); expect(allowedNavigation(Uri.parse(value)), false); } });
}
