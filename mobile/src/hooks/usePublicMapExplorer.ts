import { useCallback, useRef, useState } from 'react';
import { fetchPublicMapItems, fetchPublicParcelStatuses } from '../api/ibp-api';
import { PublicMapItem, PublicParcelStatusItem } from '../app/types';

type UsePublicMapExplorerArgs = {
  apiUrl: string;
  onStatusChange: (message: string) => void;
};

type LoadParcelsInput = {
  bbox: string;
  zoom: number;
};

export function usePublicMapExplorer({ apiUrl, onStatusChange }: UsePublicMapExplorerArgs) {
  const [items, setItems] = useState<PublicMapItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [region, setRegion] = useState('');
  const [parcelStatuses, setParcelStatuses] = useState<PublicParcelStatusItem[]>([]);
  const [parcelsLoading, setParcelsLoading] = useState(false);
  const requestRef = useRef(0);

  const loadPublicMap = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      const payload = await fetchPublicMapItems(apiUrl, {
        from: fromDate,
        to: toDate,
        region
      });
      const nextItems = Array.isArray(payload.items) ? payload.items : [];
      setItems(nextItems);
      onStatusChange(`Public map loaded: ${nextItems.length} item(s)`);
    } catch (error) {
      onStatusChange(`Public map load error: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [apiUrl, fromDate, onStatusChange, region, toDate]);

  const loadPublicParcels = useCallback(
    async (input: LoadParcelsInput): Promise<void> => {
      if (!input.bbox || input.bbox.trim().length === 0) {
        return;
      }

      const requestId = requestRef.current + 1;
      requestRef.current = requestId;
      setParcelsLoading(true);

      try {
        const payload = await fetchPublicParcelStatuses(apiUrl, {
          bbox: input.bbox,
          zoom: input.zoom,
          year: new Date().getFullYear()
        });

        if (requestRef.current !== requestId) {
          return;
        }

        const nextItems = Array.isArray(payload.items) ? payload.items : [];
        setParcelStatuses(nextItems);
      } catch (error) {
        if (requestRef.current === requestId) {
          onStatusChange(`Public parcel layer load error: ${(error as Error).message}`);
        }
      } finally {
        if (requestRef.current === requestId) {
          setParcelsLoading(false);
        }
      }
    },
    [apiUrl, onStatusChange]
  );

  return {
    items,
    loading,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    region,
    setRegion,
    parcelStatuses,
    parcelsLoading,
    loadPublicMap,
    loadPublicParcels
  };
}
