# iOS Setup

## Prerequisites

- macOS (required for Xcode and CocoaPods)
- Xcode
- CocoaPods (`gem install cocoapods`)

## Build Steps

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Install iOS pods**
   ```bash
   cd ios && pod install && cd ..
   ```

3. **Configure environment** (see [SUPABASE_SETUP.md](../SUPABASE_SETUP.md))
   - Copy `.env.example` to `.env`
   - Add your `SUPABASE_URL` and `SUPABASE_ANON_KEY`

4. **Run the app**
   ```bash
   npx react-native run-ios
   ```

## Adding Books on iOS

**Note:** The file picker for adding books is not yet implemented on iOS. Use Android to add books, or add `@react-native-documents/picker` when building for iOS (requires RN 0.79+).
