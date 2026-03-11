import { Region } from 'react-native-maps';

export function computeRegionZoom(region: Region): number {
  const longitudeDelta = Math.max(region.longitudeDelta, 0.000001);
  return Math.round(Math.log2(360 / longitudeDelta));
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
