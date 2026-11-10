import { z } from 'zod';
import type { Shipment, TrackingResult } from '@workbench/contracts';

const eventSchema = z.object({
  description: z.string().min(1),
  date: z.string().refine((value) => Number.isFinite(Date.parse(value))),
  location: z.string().optional(),
});

const itemSchema = z.object({
  status: z.string().optional(),
  events: z.array(eventSchema).optional(),
});

const responseSchema = z.object({
  tracking_results: z.array(
    z.object({
      tracking_id: z.string(),
      status: z.string().optional(),
      errors: z.array(z.unknown()).optional(),
      consignment: itemSchema.optional(),
      trackable_items: z
        .array(itemSchema.extend({ items: z.array(itemSchema).optional() }))
        .optional(),
    }),
  ),
});

type Config = { key: string; password: string; account: string };
type Options = { config?: Config; fetcher?: typeof fetch };

function unavailable(shipment: Shipment, message: string): TrackingResult {
  return {
    ...shipment,
    queryStatus: 'unavailable',
    message,
    currentStatus: null,
    lastUpdatedAt: null,
    events: [],
    source: 'auspost-test',
  };
}

export function parseTracking(
  shipment: Shipment,
  input: unknown,
): TrackingResult {
  const response = responseSchema.safeParse(input);

  if (!response.success) {
    return unavailable(shipment, 'Carrier returned an invalid response.');
  }

  const result = response.data.tracking_results.find(
    (entry) => entry.tracking_id === shipment.trackingNumber,
  );

  if (!result || result.errors?.length) {
    return unavailable(
      shipment,
      'Tracking information is unavailable for this item.',
    );
  }

  const items = result.trackable_items ?? [];
  const parts = [
    ...(result.consignment ? [result.consignment] : []),
    ...items,
    ...items.flatMap((item) => item.items ?? []),
  ];
  const allEvents = parts
    .flatMap((part) => part.events ?? [])
    .map((event) => ({
      description: event.description,
      date: event.date,
      location: event.location ?? null,
    }))
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  const events = [
    ...new Map(
      allEvents.map((event) => [JSON.stringify(event), event]),
    ).values(),
  ];

  const currentStatus =
    result.consignment?.status ??
    result.status ??
    parts.find((part) => part.status)?.status;

  if (!currentStatus || !events.length) {
    return unavailable(
      shipment,
      'Carrier did not provide a status and update time.',
    );
  }

  return {
    ...shipment,
    queryStatus: 'available',
    currentStatus,
    lastUpdatedAt: events[0]!.date,
    events,
    message: 'Response from the carrier test environment.',
    source: 'auspost-test',
  };
}

export function createTrackingService({
  config,
  fetcher = fetch,
}: Options = {}) {
  const cache = new Map<
    string,
    { expires: number; value: Promise<TrackingResult> }
  >();

  async function request(shipment: Shipment): Promise<TrackingResult> {
    if (!config) {
      return unavailable(shipment, 'Carrier credentials are not configured.');
    }

    const url = new URL(
      'https://digitalapi.auspost.com.au/test/shipping/v1/track',
    );
    url.searchParams.set('tracking_ids', shipment.trackingNumber);

    try {
      const response = await fetcher(url, {
        headers: {
          Authorization:
            'Basic ' +
            Buffer.from(config.key + ':' + config.password).toString('base64'),
          'account-number': config.account,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(7000),
      });

      if (!response.ok) {
        const message =
          response.status === 401 || response.status === 403
            ? 'Carrier access denied. Check credentials and account permissions.'
            : response.status === 429
              ? 'Carrier rate limit reached. Please try again later.'
              : 'Carrier service is unavailable (HTTP ' +
                response.status +
                ').';

        return unavailable(shipment, message);
      }

      return parseTracking(shipment, await response.json());
    } catch (error) {
      const timeout =
        error instanceof Error &&
        ['TimeoutError', 'AbortError'].includes(error.name);

      return unavailable(
        shipment,
        timeout
          ? 'Carrier request timed out.'
          : 'Carrier request failed or returned unreadable data.',
      );
    }
  }

  return function track(shipment: Shipment): Promise<TrackingResult> {
    if (shipment.carrier === 'tnt') {
      return Promise.resolve({
        ...shipment,
        queryStatus: 'not_implemented',
        message: 'TNT integration is not implemented.',
        currentStatus: null,
        lastUpdatedAt: null,
        events: [],
        source: null,
      });
    }

    const cached = cache.get(shipment.id);

    if (cached && cached.expires > Date.now()) {
      return cached.value;
    }

    const value = request(shipment);
    cache.set(shipment.id, { expires: Date.now() + 60000, value });

    return value;
  };
}

export function trackingFromEnvironment() {
  const key = process.env.AUSPOST_API_KEY;
  const password = process.env.AUSPOST_API_PASSWORD;
  const account = process.env.AUSPOST_ACCOUNT_NUMBER;

  return createTrackingService(
    key && password && account ? { config: { key, password, account } } : {},
  );
}
