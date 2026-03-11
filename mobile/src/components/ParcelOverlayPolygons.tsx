import { useMemo } from 'react';
import { LatLng, Polygon } from 'react-native-maps';
import { PublicParcelStatusItem } from '../app/types';

type RenderableParcelPolygon = {
  key: string;
  parcelId: string;
  studyStatus: 'studied' | 'not_studied';
  outer: LatLng[];
  holes: LatLng[][];
};

const toFiniteNumber = (value: unknown): number | null => {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const toLatLng = (position: unknown): LatLng | null => {
  if (!Array.isArray(position) || position.length < 2) {
    return null;
  }

  const lng = toFiniteNumber(position[0]);
  const lat = toFiniteNumber(position[1]);
  if (lat === null || lng === null) {
    return null;
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }

  return { latitude: lat, longitude: lng };
};

const toRingCoordinates = (value: unknown): LatLng[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const ring = value.map((position) => toLatLng(position)).filter((coordinate): coordinate is LatLng => Boolean(coordinate));
  return ring.length >= 3 ? ring : [];
};

const extractRenderableParcelPolygons = (items: PublicParcelStatusItem[]): RenderableParcelPolygon[] => {
  const output: RenderableParcelPolygon[] = [];

  for (const item of items) {
    const geometry = item.geometry;
    if (!geometry || !geometry.coordinates) {
      continue;
    }

    if (geometry.type === 'Polygon' && Array.isArray(geometry.coordinates)) {
      const rings = geometry.coordinates as unknown[];
      const outer = toRingCoordinates(rings[0]);
      if (outer.length === 0) {
        continue;
      }
      const holes = rings.slice(1).map((ring) => toRingCoordinates(ring)).filter((ring) => ring.length >= 3);
      output.push({
        key: `${item.parcel_id}-polygon`,
        parcelId: item.parcel_id,
        studyStatus: item.study_status,
        outer,
        holes
      });
      continue;
    }

    if (geometry.type === 'MultiPolygon' && Array.isArray(geometry.coordinates)) {
      const polygons = geometry.coordinates as unknown[];
      polygons.forEach((polygonCoordinates, index) => {
        if (!Array.isArray(polygonCoordinates) || polygonCoordinates.length === 0) {
          return;
        }
        const rings = polygonCoordinates as unknown[];
        const outer = toRingCoordinates(rings[0]);
        if (outer.length === 0) {
          return;
        }
        const holes = rings.slice(1).map((ring) => toRingCoordinates(ring)).filter((ring) => ring.length >= 3);
        output.push({
          key: `${item.parcel_id}-multi-${index}`,
          parcelId: item.parcel_id,
          studyStatus: item.study_status,
          outer,
          holes
        });
      });
    }
  }

  return output;
};

type ParcelOverlayPolygonsProps = {
  items: PublicParcelStatusItem[];
  selectedParcelIds?: string[];
  onParcelPress?: (parcelId: string) => void;
};

export function ParcelOverlayPolygons({ items, selectedParcelIds = [], onParcelPress }: ParcelOverlayPolygonsProps) {
  const parcelPolygons = useMemo(() => extractRenderableParcelPolygons(items), [items]);
  const selectedIds = useMemo(() => new Set(selectedParcelIds.map((id) => id.trim().toUpperCase())), [selectedParcelIds]);

  return (
    <>
      {parcelPolygons.map((polygon) => {
        const studied = polygon.studyStatus === 'studied';
        const selected = selectedIds.has(polygon.parcelId.trim().toUpperCase());
        return (
          <Polygon
            key={polygon.key}
            coordinates={polygon.outer}
            holes={polygon.holes.length > 0 ? polygon.holes : undefined}
            strokeColor={selected ? '#1d5fa2' : studied ? '#2f7d56' : '#6f8d74'}
            fillColor={selected ? 'rgba(29, 95, 162, 0.34)' : studied ? 'rgba(54, 129, 86, 0.18)' : 'rgba(118, 132, 120, 0.12)'}
            tappable={typeof onParcelPress === 'function'}
            onPress={onParcelPress ? () => onParcelPress(polygon.parcelId) : undefined}
            zIndex={1}
          />
        );
      })}
    </>
  );
}
