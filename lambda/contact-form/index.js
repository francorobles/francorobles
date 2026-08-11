const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const RECIPIENT = 'hello@francorobles.com';
const SENDER    = 'hello@francorobles.com'; // must be verified in AWS SES

const ses = new SESClient({ region: process.env.AWS_REGION || 'us-east-1' });

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  'https://francorobles.com',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  let data;
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString()
      : event.body || '';

    const ct = (event.headers?.['content-type'] || event.headers?.['Content-Type'] || '');
    data = ct.includes('application/json')
      ? JSON.parse(raw)
      : Object.fromEntries(new URLSearchParams(raw));
  } catch {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ response: 'error', errorMessage: 'Invalid request body' }) };
  }

  const { name = 'Unknown', email = '', subject = 'New message from portfolio', message = '' } = data;

  const html = `
    <p><strong>Name:</strong> ${esc(name)}</p>
    <p><strong>Email:</strong> ${esc(email)}</p>
    <p><strong>Subject:</strong> ${esc(subject)}</p>
    <hr>
    <p>${esc(message).replace(/\n/g, '<br>')}</p>
  `;

  try {
    await ses.send(new SendEmailCommand({
      Source: SENDER,
      Destination: { ToAddresses: [RECIPIENT] },
      ReplyToAddresses: email ? [`${esc(name)} <${email}>`] : [],
      Message: {
        Subject: { Data: `[Portfolio] ${subject}`, Charset: 'UTF-8' },
        Body:    { Html: { Data: html, Charset: 'UTF-8' } },
      },
    }));
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ response: 'success' }) };
  } catch (err) {
    console.error('SES error:', err.message);
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ response: 'error', errorMessage: 'Failed to send message. Please try again later.' }) };
  }
};

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
