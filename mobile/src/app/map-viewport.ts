import { Region } from 'react-native-maps';

export const DEFAULT_FRANCE_CENTER = { lat: 46.603354, lng: 1.888334 };

export function buildFocusedMapRegion(location: { lat: number; lng: number }): Region {
  return {
    latitude: location.lat,
    longitude: location.lng,
    latitudeDelta: 0.015,
    longitudeDelta: 0.015
  };
}

export function computeRegionZoom(region: Region): number {
  const longitudeDelta = Math.max(region.longitudeDelta, 0.000001);
  return Math.round(Math.log2(360 / longitudeDelta));
}

export function areRegionsNearlyEqual(a: Region, b: Region, epsilon = 0.00001): boolean {
  return (
    Math.abs(a.latitude - b.latitude) <= epsilon &&
    Math.abs(a.longitude - b.longitude) <= epsilon &&
    Math.abs(a.latitudeDelta - b.latitudeDelta) <= epsilon &&
    Math.abs(a.longitudeDelta - b.longitudeDelta) <= epsilon
  );
}

export function computeRegionBbox(region: Region): string {
  const halfLat = region.latitudeDelta / 2;
  const halfLng = region.longitudeDelta / 2;
  const minLat = Math.max(-90, region.latitude - halfLat);
  const maxLat = Math.min(90, region.latitude + halfLat);
  const minLng = Math.max(-180, region.longitude - halfLng);
  const maxLng = Math.min(180, region.longitude + halfLng);
  return `${minLng.toFixed(6)},${minLat.toFixed(6)},${maxLng.toFixed(6)},${maxLat.toFixed(6)}`;
}
