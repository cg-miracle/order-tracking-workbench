import {
  Alert,
  Box,
  Chip,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material';
import type { Shipment, TrackingResult } from '@workbench/contracts';
import { carrierLabel, formatDateTime } from './format';

export function ShipmentTracking({
  shipment,
  result,
}: {
  shipment: Shipment;
  result: TrackingResult | undefined;
}) {
  const eventTime = (date: string) =>
    result?.source === 'tnt'
      ? date.replace('T', ' ') + ' (carrier local time)'
      : formatDateTime(date);
  const available = result?.queryStatus === 'available';

  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        p: { xs: 2, sm: 3 },
      }}
    >
      <Stack spacing={2.5} sx={{ overflowWrap: 'anywhere' }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          justifyContent="space-between"
          alignItems={{ sm: 'flex-start' }}
        >
          <Box>
            <Typography fontWeight={600}>
              {carrierLabel(shipment.carrier)}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Tracking number: {shipment.trackingNumber}
            </Typography>
          </Box>
          {result && (
            <Chip
              size="small"
              color={available ? 'primary' : 'default'}
              label={
                available
                  ? result.currentStatus
                  : result.queryStatus === 'unavailable'
                    ? 'Unavailable'
                    : 'Not implemented'
              }
            />
          )}
        </Stack>

        {result?.source === 'auspost-test' && (
          <Alert severity="info" variant="outlined">
            Carrier test environment · cached for up to 60 seconds
          </Alert>
        )}

        {result && !available && (
          <Typography variant="body2" color="text.secondary">
            {result.message}
          </Typography>
        )}

        {result?.lastUpdatedAt && (
          <Typography variant="body2" color="text.secondary">
            Last updated:{' '}
            <Box component="time" dateTime={result.lastUpdatedAt}>
              {eventTime(result.lastUpdatedAt)}
            </Box>
          </Typography>
        )}

        {available && (
          <Stepper
            component="ol"
            orientation="vertical"
            activeStep={0}
            nonLinear
            aria-label="Shipment tracking history"
            sx={{
              m: 0,
              p: 0,
              listStyle: 'none',
              '& .MuiStepConnector-line': { minHeight: 24 },
            }}
          >
            {result.events.map((event, index) => (
              <Step component="li" key={JSON.stringify(event)}>
                <StepLabel
                  icon={
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        mx: 0.75,
                        bgcolor:
                          index === 0 ? 'primary.main' : 'action.disabled',
                        boxShadow: index === 0 ? 3 : 0,
                      }}
                    />
                  }
                >
                  <Stack spacing={0.5}>
                    <Typography
                      variant="body2"
                      fontWeight={index === 0 ? 700 : 500}
                    >
                      {event.description}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      component="time"
                      dateTime={event.date}
                    >
                      {eventTime(event.date)}
                    </Typography>
                    {event.location && (
                      <Typography variant="caption" color="text.secondary">
                        {event.location}
                      </Typography>
                    )}
                  </Stack>
                </StepLabel>
              </Step>
            ))}
          </Stepper>
        )}
      </Stack>
    </Box>
  );
}
