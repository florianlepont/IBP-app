type ManualLocationLike = {
  source?: unknown;
  address_line?: unknown;
  postal_code?: unknown;
  city?: unknown;
  country?: unknown;
  [key: string]: unknown;
};

type DraftWithLocation = {
  location?: unknown;
  [key: string]: unknown;
};

type VerifyManualLocationParams = {
  setStatus: (message: string) => void;
};

const toTrimmedString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export async function verifyManualLocation<T extends DraftWithLocation>(
  draftInput: T,
  params: VerifyManualLocationParams
): Promise<T | null> {
  const location = draftInput.location;
  if (!location || typeof location !== 'object' || Array.isArray(location)) {
    return draftInput;
  }

  const manualLocation = location as ManualLocationLike;
  if (manualLocation.source !== 'manual') {
    return draftInput;
  }

  const addressLine = toTrimmedString(manualLocation.address_line);
  const postalCode = toTrimmedString(manualLocation.postal_code);
  const city = toTrimmedString(manualLocation.city);
  const country = toTrimmedString(manualLocation.country);
  const addressQuery = [addressLine, postalCode, city, country].filter((value) => value.length > 0).join(', ');

  if (!addressQuery) {
    params.setStatus('Address verification failed: incomplete manual address');
    return null;
  }

  try {
    params.setStatus('Verifying manual address...');
    const Location = await import('expo-location');
    const matches = await Location.geocodeAsync(addressQuery);
    const firstMatch = matches.find((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude));

    if (!firstMatch) {
      params.setStatus('Address verification failed: no match found');
      return null;
    }

    params.setStatus('Manual address verified');
    return {
      ...draftInput,
      location: {
        ...manualLocation,
        source: 'manual',
        lat: firstMatch.latitude,
        lng: firstMatch.longitude,
        geocoded_at: new Date().toISOString(),
        geocode_query: addressQuery,
        geocode_provider: 'expo-location'
      }
    };
  } catch (error) {
    params.setStatus(`Address verification error: ${(error as Error).message}`);
    return null;
  }
}
