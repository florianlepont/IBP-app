import { useEffect, useRef, useState } from 'react';
import { Region } from 'react-native-maps';
import { fetchPublicParcelStatuses } from '../api/ibp-api';
import { computeRegionBbox, computeRegionZoom } from '../app/map-viewport';
import { PublicParcelStatusItem } from '../app/types';

type UseParcelStatusesInput = {
  apiUrl: string;
  region: Region;
  enabled?: boolean;
  debounceMs?: number;
  year?: number;
};

export function useParcelStatuses({ apiUrl, region, enabled = true, debounceMs = 400, year }: UseParcelStatusesInput) {
  const [items, setItems] = useState<PublicParcelStatusItem[]>([]);
  const [loading, setLoading] = useState(false);
  const requestRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setLoading(false);
      return;
    }

    const timer = setTimeout(() => {
      const requestId = requestRef.current + 1;
      requestRef.current = requestId;
      setLoading(true);

      const bbox = computeRegionBbox(region);
      const zoom = computeRegionZoom(region);

      void fetchPublicParcelStatuses(apiUrl, {
        bbox,
        zoom,
        year
      })
        .then((payload) => {
          if (requestRef.current !== requestId) {
            return;
          }
          setItems(Array.isArray(payload.items) ? payload.items : []);
        })
        .catch(() => {
          if (requestRef.current !== requestId) {
            return;
          }
          setItems([]);
        })
        .finally(() => {
          if (requestRef.current === requestId) {
            setLoading(false);
          }
        });
    }, debounceMs);

    return () => {
      clearTimeout(timer);
    };
  }, [apiUrl, enabled, year, debounceMs, region.latitude, region.longitude, region.latitudeDelta, region.longitudeDelta]);

  return {
    items,
    loading
  };
}
