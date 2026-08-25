const crypto = require('crypto');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const RECIPIENT = 'hello@francorobles.com';
const SENDER    = 'hello@francorobles.com'; // must be verified in AWS SES
const CAPTCHA_SECRET = process.env.CAPTCHA_SECRET || 'local-dev-captcha-secret';
const CAPTCHA_TTL_MS = 10 * 60 * 1000;

const ses = new SESClient({ region: process.env.AWS_REGION || 'us-east-1' });

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  'https://francorobles.com',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

exports.handler = async (event) => {
  const method = event.requestContext?.http?.method || 'POST';

  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (method === 'GET') {
    return {
      statusCode: 200,
      headers: {
        ...CORS_HEADERS,
        'Cache-Control': 'no-store',
      },
      body: JSON.stringify({
        response: 'success',
        captcha: createCaptchaChallenge(),
      }),
    };
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

  if (!isValidCaptcha(data.captchaToken, data.captchaAnswer)) {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ response: 'error', errorMessage: 'Captcha verification failed. Please try again.' }),
    };
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

function createCaptchaChallenge() {
  const left = crypto.randomInt(2, 10);
  const right = crypto.randomInt(2, 10);
  const issuedAt = Date.now();
  const payload = `${left}:${right}:${issuedAt}`;
  const signature = sign(payload);

  return {
    question: `What is ${left} + ${right}?`,
    token: Buffer.from(`${payload}:${signature}`).toString('base64url'),
  };
}

function isValidCaptcha(token, answer) {
  if (!token || answer === undefined || answer === null) {
    return false;
  }

  let decoded;
  try {
    decoded = Buffer.from(String(token), 'base64url').toString('utf8');
  } catch {
    return false;
  }

  const parts = decoded.split(':');
  if (parts.length !== 4) {
    return false;
  }

  const [leftRaw, rightRaw, issuedAtRaw, providedSignature] = parts;
  const payload = `${leftRaw}:${rightRaw}:${issuedAtRaw}`;
  const expectedSignature = sign(payload);

  if (!timingSafeEqual(providedSignature, expectedSignature)) {
    return false;
  }

  const left = Number(leftRaw);
  const right = Number(rightRaw);
  const issuedAt = Number(issuedAtRaw);
  const submittedAnswer = Number(String(answer).trim());

  if (!Number.isInteger(left) || !Number.isInteger(right) || !Number.isFinite(issuedAt) || !Number.isFinite(submittedAnswer)) {
    return false;
  }

  if ((Date.now() - issuedAt) > CAPTCHA_TTL_MS) {
    return false;
  }

  return submittedAnswer === (left + right);
}

function sign(payload) {
  return crypto
    .createHmac('sha256', CAPTCHA_SECRET)
    .update(payload)
    .digest('hex');
}

function timingSafeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}
