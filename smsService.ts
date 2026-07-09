import { dbHelper } from './dbHelper.ts';

/**
 * Exotel SMS Service
 * Integrates with Exotel API to send SMS notifications.
 */
export async function sendSMS(to: string, body: string, customRoute?: string) {
  let smsConfig: any = {};
  try {
    const savedConfigStr = dbHelper.getConfig();
    if (savedConfigStr) {
      smsConfig = JSON.parse(savedConfigStr);
    }
  } catch (err) {
    console.error("Failed to read SMS config from Database:", err);
  }

  const apiKey = smsConfig.fast2smsApiKey || process.env.FAST2SMS_API_KEY;
  const route = customRoute || smsConfig.fast2smsRoute || process.env.FAST2SMS_ROUTE || 'q';

  if (!apiKey) {
    console.warn('Fast2SMS credentials not configured. SMS sending will be disabled.');
    return null;
  }

  const url = 'https://www.fast2sms.com/dev/bulkV2';

  try {
    const payload = {
        authorization: apiKey,
        variables_values: body, // Assuming body is the content to be sent
        route: route,
        numbers: to,
        flash: 0
    };

    console.log(`Sending SMS to ${to} via Fast2SMS. Route: ${route}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'authorization': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok || data.return === false) {
      throw new Error(`Fast2SMS API error: ${data.message || JSON.stringify(data)}`);
    }

    console.log('SMS sent successfully via Fast2SMS. Request ID: %s', data.request_id);
    return data;
  } catch (error) {
    console.error('Error sending SMS via Fast2SMS:', error);
    return { error: error instanceof Error ? error.message : String(error) };
  }
}
