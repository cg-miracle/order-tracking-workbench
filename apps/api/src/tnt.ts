import { XMLBuilder, XMLParser, XMLValidator } from 'fast-xml-parser';
import { z } from 'zod';
import type { Shipment, TrackingResult } from '@workbench/contracts';

export type TntConfig = { username: string; password: string };

const statusSchema = z.object({
  StatusDescription: z.string().min(1),
  LocalEventDate: z.string().regex(/^\d{8}$/),
  LocalEventTime: z.string().regex(/^\d{4}$/),
  Depot: z.string().optional(),
});
const consignmentSchema = z.object({
  ConsignmentNumber: z.string(),
  SummaryCode: z.string(),
  StatusData: z.array(statusSchema).optional(),
});
const responseSchema = z.object({
  TrackResponse: z.object({ Consignment: z.array(consignmentSchema) }),
});

export function tntUnavailable(
  shipment: Shipment,
  message: string,
): TrackingResult {
  return {
    ...shipment,
    source: 'tnt',
    queryStatus: 'unavailable',
    message,
    currentStatus: null,
    lastUpdatedAt: null,
    events: [],
  };
}

export function parseTntTracking(
  shipment: Shipment,
  xml: string,
): TrackingResult {
  const invalid = () =>
    tntUnavailable(
      shipment,
      'TNT returned no matching consignment with valid status and local event time.',
    );
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || XMLValidator.validate(xml) !== true) {
    return invalid();
  }
  const input: unknown = new XMLParser({
    parseTagValue: false,
    ignoreAttributes: true,
    isArray: (name) => ['Consignment', 'StatusData'].includes(name),
  }).parse(xml);
  const parsed = responseSchema.safeParse(input);
  if (!parsed.success) {
    return invalid();
  }
  const matches = parsed.data.TrackResponse.Consignment.filter(
    (entry) => entry.ConsignmentNumber === shipment.trackingNumber,
  );
  if (matches.length !== 1) {
    return invalid();
  }
  const result = matches[0]!;
  if (result.SummaryCode === 'CNF' || !result.StatusData?.length) {
    return invalid();
  }
  const events = result.StatusData.map((event) => {
    const d = event.LocalEventDate;
    const t = event.LocalEventTime;
    // TNT reports local wall time without an offset. Preserve it instead of inventing UTC.
    const date = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${t.slice(0, 2)}:${t.slice(2, 4)}:00`;

    return {
      description: event.StatusDescription,
      date,
      location: event.Depot ?? null,
    };
  }).sort((a, b) => b.date.localeCompare(a.date));
  if (
    events.some(
      (event) =>
        !Number.isFinite(Date.parse(event.date)) ||
        new Date(event.date + 'Z').toISOString().slice(0, 19) !== event.date ||
        event.date.slice(11, 13) > '23' ||
        event.date.slice(14, 16) > '59',
    )
  ) {
    return invalid();
  }

  return {
    ...shipment,
    source: 'tnt',
    queryStatus: 'available',
    currentStatus: events[0]!.description,
    lastUpdatedAt: events[0]!.date,
    events,
    message:
      'TNT ExpressConnect response. Event times are carrier local times; timezone is not supplied.',
  };
}

export async function requestTntTracking(
  shipment: Shipment,
  config: TntConfig | undefined,
  fetcher: typeof fetch,
): Promise<TrackingResult> {
  if (!config) {
    return tntUnavailable(
      shipment,
      'TNT ExpressConnect credentials are not configured. Australian Weblinking and RTT accounts may require separate access.',
    );
  }
  const xml = new XMLBuilder({ ignoreAttributes: false }).build({
    TrackRequest: {
      SearchCriteria: {
        '@_marketType': 'Domestic',
        '@_originCountry': 'AU',
        ConsignmentNumber: shipment.trackingNumber,
      },
      LevelOfDetail: { Complete: '' },
    },
  });
  try {
    const response = await fetcher(
      'https://express.tnt.com/expressconnect/track.do',
      {
        method: 'POST',
        redirect: 'error',
        headers: {
          Authorization:
            'Basic ' +
            Buffer.from(config.username + ':' + config.password).toString(
              'base64',
            ),
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/xml',
        },
        body: new URLSearchParams({ xml_in: xml }),
        signal: AbortSignal.timeout(7000),
      },
    );
    if (!response.ok) {
      return tntUnavailable(
        shipment,
        `TNT service unavailable (HTTP ${response.status}). Check ExpressConnect access and Australian domestic coverage.`,
      );
    }

    return parseTntTracking(shipment, await response.text());
  } catch (error) {
    return tntUnavailable(
      shipment,
      error instanceof Error &&
        ['TimeoutError', 'AbortError'].includes(error.name)
        ? 'TNT request timed out.'
        : 'TNT request failed or returned unreadable data.',
    );
  }
}
