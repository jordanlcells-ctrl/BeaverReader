# Android release signing (local secrets)

Release signing uses these Gradle project properties:

| Property | Where to set |
|------------|----------------|
| `UPLOAD_STORE_FILE` | `android/gradle.properties` (path relative to `android/app/`, e.g. `upload-key.keystore`) |
| `UPLOAD_KEY_ALIAS` | `android/gradle.properties` |
| `UPLOAD_STORE_PASSWORD` | **Only** in your user Gradle file (see below) |
| `UPLOAD_KEY_PASSWORD` | **Only** in your user Gradle file |

## Set passwords (do not commit)

Create or edit **`%USERPROFILE%\.gradle\gradle.properties`** (Windows) or **`~/.gradle/gradle.properties`** (macOS/Linux) and add:

```properties
UPLOAD_STORE_PASSWORD=your-store-password
UPLOAD_KEY_PASSWORD=your-key-password
```

Gradle merges this file with `android/gradle.properties`, so the same property names work.

## Release builds without upload credentials

If the password properties are missing, `assembleRelease` uses the **debug** keystore so local CI/dev still builds. **Do not upload that APK to Play Console** — configure user `gradle.properties` first.
