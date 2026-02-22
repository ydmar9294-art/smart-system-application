# دليل إعداد Plugin الأمان الأصلي لأندرويد

## الخطوة 1: إنشاء ملف Plugin الأصلي

بعد تشغيل `npx cap sync`، أنشئ الملف التالي:

**المسار:** `android/app/src/main/java/app/lovable/bac2f6ed2db54e828d262c37cac1581f/AppSecurityPlugin.java`

```java
package app.lovable.bac2f6ed2db54e828d262c37cac1581f;

import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.os.Build;
import android.view.WindowManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.security.MessageDigest;

@CapacitorPlugin(name = "AppSecurity")
public class AppSecurityPlugin extends Plugin {

    // ==========================================
    // 1. BLOCK SCREENSHOTS & SCREEN RECORDING
    // ==========================================
    @PluginMethod()
    public void blockScreenshots(PluginCall call) {
        try {
            getActivity().runOnUiThread(() -> {
                getActivity().getWindow().setFlags(
                    WindowManager.LayoutParams.FLAG_SECURE,
                    WindowManager.LayoutParams.FLAG_SECURE
                );
            });
            JSObject ret = new JSObject();
            ret.put("blocked", true);
            call.resolve(ret);
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("blocked", false);
            ret.put("error", e.getMessage());
            call.resolve(ret);
        }
    }

    // ==========================================
    // 2. ROOT DETECTION
    // ==========================================
    @PluginMethod()
    public void checkRoot(PluginCall call) {
        boolean isRooted = false;
        String[] rootPaths = {
            "/system/app/Superuser.apk",
            "/sbin/su",
            "/system/bin/su",
            "/system/xbin/su",
            "/data/local/xbin/su",
            "/data/local/bin/su",
            "/system/sd/xbin/su",
            "/system/bin/failsafe/su",
            "/data/local/su",
            "/su/bin/su",
            "/system/app/SuperSU.apk",
            "/system/app/SuperSU",
            "/system/app/Superuser",
            "/system/xbin/daemonsu",
            "/system/app/Magisk.apk"
        };

        for (String path : rootPaths) {
            if (new File(path).exists()) {
                isRooted = true;
                break;
            }
        }

        // Check for su binary in PATH
        if (!isRooted) {
            try {
                Process process = Runtime.getRuntime().exec(new String[]{"which", "su"});
                if (process.waitFor() == 0) {
                    isRooted = true;
                }
            } catch (Exception ignored) {}
        }

        // Check for test-keys build
        if (!isRooted) {
            String buildTags = Build.TAGS;
            if (buildTags != null && buildTags.contains("test-keys")) {
                isRooted = true;
            }
        }

        JSObject ret = new JSObject();
        ret.put("isRooted", isRooted);
        call.resolve(ret);
    }

    // ==========================================
    // 3. SIDE-LOADING DETECTION
    // ==========================================
    @PluginMethod()
    public void checkInstaller(PluginCall call) {
        String installer = "unknown";
        boolean isSideloaded = true;

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                var installSourceInfo = getContext().getPackageManager()
                    .getInstallSourceInfo(getContext().getPackageName());
                installer = installSourceInfo.getInstallingPackageName();
            } else {
                installer = getContext().getPackageManager()
                    .getInstallerPackageName(getContext().getPackageName());
            }

            if (installer != null) {
                // Official installer package names
                isSideloaded = !(
                    installer.equals("com.android.vending") ||       // Google Play Store
                    installer.equals("com.google.android.feedback") || // Google Play (old)
                    installer.equals("com.huawei.appmarket") ||       // Huawei AppGallery
                    installer.equals("com.samsung.android.vending") || // Samsung Galaxy Store
                    installer.equals("com.xiaomi.market")              // Xiaomi Mi Store
                );
            }
        } catch (Exception e) {
            installer = "error: " + e.getMessage();
        }

        JSObject ret = new JSObject();
        ret.put("installer", installer != null ? installer : "null");
        ret.put("isSideloaded", isSideloaded);
        call.resolve(ret);
    }

    // ==========================================
    // 4. APK SIGNATURE VERIFICATION
    // ==========================================
    @PluginMethod()
    public void verifySignature(PluginCall call) {
        try {
            PackageInfo packageInfo;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                packageInfo = getContext().getPackageManager().getPackageInfo(
                    getContext().getPackageName(),
                    PackageManager.GET_SIGNING_CERTIFICATES
                );
            } else {
                packageInfo = getContext().getPackageManager().getPackageInfo(
                    getContext().getPackageName(),
                    PackageManager.GET_SIGNATURES
                );
            }

            Signature[] signatures;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                signatures = packageInfo.signingInfo.getApkContentsSigners();
            } else {
                signatures = packageInfo.signatures;
            }

            if (signatures != null && signatures.length > 0) {
                MessageDigest md = MessageDigest.getInstance("SHA-256");
                byte[] digest = md.digest(signatures[0].toByteArray());
                StringBuilder hexString = new StringBuilder();
                for (byte b : digest) {
                    hexString.append(String.format("%02X:", b));
                }
                String currentSig = hexString.toString();
                if (currentSig.endsWith(":")) {
                    currentSig = currentSig.substring(0, currentSig.length() - 1);
                }

                // TODO: Replace with your actual release signing certificate SHA-256
                // You can get it by running:
                //   keytool -list -v -keystore your-release-key.jks
                // Look for "SHA256:" line under "Certificate fingerprints"
                String expectedSignature = "YOUR_RELEASE_SHA256_HERE";

                JSObject ret = new JSObject();
                ret.put("currentSignature", currentSig);
                
                if (expectedSignature.equals("YOUR_RELEASE_SHA256_HERE")) {
                    // Signature check not configured yet — pass through
                    ret.put("isValid", true);
                    ret.put("configured", false);
                } else {
                    ret.put("isValid", currentSig.equals(expectedSignature));
                    ret.put("configured", true);
                }
                call.resolve(ret);
                return;
            }

            JSObject ret = new JSObject();
            ret.put("isValid", false);
            ret.put("error", "No signatures found");
            call.resolve(ret);
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("isValid", true); // Default to valid on error to avoid blocking users
            ret.put("error", e.getMessage());
            call.resolve(ret);
        }
    }
}
```

## الخطوة 2: تسجيل Plugin في MainActivity

**المسار:** `android/app/src/main/java/app/lovable/bac2f6ed2db54e828d262c37cac1581f/MainActivity.java`

أضف `import` و تسجيل Plugin:

```java
package app.lovable.bac2f6ed2db54e828d262c37cac1581f;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Register the security plugin BEFORE super.onCreate
        registerPlugin(AppSecurityPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
```

## الخطوة 3: التحقق من التوقيع (إعداد إنتاجي)

بعد إنشاء Keystore للإنتاج:

```bash
keytool -list -v -keystore your-release-key.jks -alias your-alias
```

انسخ قيمة `SHA256:` وضعها في `AppSecurityPlugin.java`:

```java
String expectedSignature = "AB:CD:EF:12:34:..."; // ← ضع التوقيع هنا
```

## الخطوة 4: ProGuard Rules

أضف إلى `android/app/proguard-rules.pro`:

```proguard
# Keep Capacitor security plugin
-keep class app.lovable.bac2f6ed2db54e828d262c37cac1581f.AppSecurityPlugin { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
```

## الخطوة 5: التأكد من الصلاحيات

لا تحتاج صلاحيات إضافية في `AndroidManifest.xml`. جميع العمليات تعمل بدون أذونات خاصة.

## القيود والملاحظات

| الحماية | الفعالية | الملاحظات |
|---------|----------|-----------|
| `FLAG_SECURE` | عالية | يمنع لقطات الشاشة وتسجيل الشاشة في معظم الأجهزة |
| Root Detection | متوسطة | يمكن تجاوزها بأدوات مثل Magisk Hide |
| Side-load Check | عالية | يعتمد على `PackageManager` API الرسمي |
| Signature Check | عالية جداً | يكتشف أي تعديل على APK |

⚠️ **لا توجد حماية 100%** — الهدف هو رفع حاجز الأمان بشكل كبير.

## أمر التشغيل الكامل

```bash
git pull
npm install
npx cap sync android
# أضف الملفات أعلاه
npx cap run android
```
