#!/usr/bin/env node
// One-time diagnostic — tests RESEND_API_KEY against the Resend API.
// Usage: node scripts/test-email.js

require('dotenv').config({ path: '.env.local' });
const { Resend } = require('resend');

const apiKey = process.env.RESEND_API_KEY;

if (!apiKey) {
  console.error('ERROR: RESEND_API_KEY not found in .env.local');
  process.exit(1);
}

console.log('RESEND_API_KEY:', `${apiKey.slice(0, 8)}${'*'.repeat(apiKey.length - 8)}`);
console.log('');

const resend = new Resend(apiKey);

async function run() {
  console.log('--- Sending test email to abhinav@bricksofindia.com ---');
  try {
    const { data, error } = await resend.emails.send({
      from: 'Bricks of India <abhinav@bricksofindia.com>',
      replyTo: 'abhinav@bricksofindia.com',
      to: 'abhinav@bricksofindia.com',
      subject: '[BOI test] Resend working — ' + new Date().toISOString(),
      text: 'If you received this, RESEND_API_KEY is correct and Resend is working.',
    });

    if (error) {
      console.error('✗ Send FAILED');
      console.error('  name   :', error.name);
      console.error('  message:', error.message);
      console.error('');
      console.error('Common causes:');
      console.error('  ValidationError  — from address domain not verified in Resend dashboard');
      console.error('  invalid_api_key  — wrong RESEND_API_KEY');
      process.exit(1);
    }

    console.log('✓ Email sent successfully');
    console.log('  id:', data?.id);
  } catch (err) {
    console.error('✗ Send threw exception:', err.message);
    process.exit(1);
  }
}

run();
