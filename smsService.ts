/**
 * Exotel SMS Service
 * Integrates with Exotel API to send SMS notifications.
 */

export async function sendSMS(to: string, body: string) {
  const apiKey = process.env.EXOTEL_API_KEY || '7667487e930b072f66225a9152d90024036c04e484c4909a';
  const apiToken = process.env.EXOTEL_API_TOKEN || '02715f2d1f0461f9bcd905f16ae0d46eef027d6497a5ea9c';
  const accountSid = process.env.EXOTEL_ACCOUNT_SID || 'dishadiagnostics1';
  const subdomain = process.env.EXOTEL_SUBDOMAIN || 'api.exotel.com';
  const senderId = process.env.EXOTEL_SENDER_ID || 'DISHAD'; // Default Sender ID

  if (!apiKey || !apiToken || !accountSid) {
    console.warn('Exotel credentials not fully configured. SMS sending will be disabled.');
    return null;
  }

  // Exotel API endpoint for sending SMS
  // URL format: https://<api_key>:<api_token>@<subdomain>/v1/Accounts/<account_sid>/Sms/send.json
  const url = `https://${subdomain}/v1/Accounts/${accountSid}/Sms/send.json`;

  try {
    const auth = Buffer.from(`${apiKey}:${apiToken}`).toString('base64');
    
    const params = new URLSearchParams();
    params.append('From', senderId);
    params.append('To', to);
    params.append('Body', body);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Exotel API error: ${data.RestResponse?.Errors?.Message || response.statusText}`);
    }

    console.log('SMS sent via Exotel: %s', data.RestResponse?.SmsMessage?.Sid);
    return data;
  } catch (error) {
    // console.error('Error sending SMS via Exotel:', error); // Muted to prevent spam
    return { error: error instanceof Error ? error.message : String(error) };
  }
}
