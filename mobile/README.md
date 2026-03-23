# Mobile (Expo + React Native)

## Stack
- React Native
- Expo
- TypeScript

## Environment
Create `mobile/.env` from `.env.example`:

```bash
cp mobile/.env.example mobile/.env
```

Recommended values:
- iOS Simulator: `EXPO_PUBLIC_API_URL=http://localhost:3000/v1`
- Android Emulator: `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000/v1`
- Physical phone (same Wi-Fi as Mac): `EXPO_PUBLIC_API_URL=http://<YOUR_MAC_LAN_IP>:3000/v1`
- Optional timeout (ms): `EXPO_PUBLIC_API_TIMEOUT_MS=15000`

## Run
```bash
npm run dev:mobile
```

Then open the app and tap **Check API /health**.

## Physical phone

Recommended path:

```bash
npm run dev:mobile
```

Then:
- open Expo Go on the phone
- keep phone and Mac on the same Wi-Fi
- scan the QR code from Expo
- if you want the local API, set `EXPO_PUBLIC_API_URL=http://<YOUR_MAC_LAN_IP>:3000/v1`
- or edit the API URL directly from the auth screen via the **API** pill

## Native iOS dev build

If you need a development build on a real iPhone:

```bash
npm run ios -- --device
```

If CocoaPods fails with `ReactCodegen.modulemap` missing:

```bash
cd mobile/ios
pod install
```
