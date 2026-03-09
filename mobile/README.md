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

## Run
```bash
npm run dev:mobile
```

Then open the app and tap **Check API /health**.
