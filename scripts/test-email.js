#!/usr/bin/env node
// One-time diagnostic — tests GMAIL_USER + GMAIL_APP_PASSWORD against live SMTP.
// Usage: node scripts/test-email.js

require('dotenv').config({ path: '.env.local' });
const nodemailer = require('nodemailer');

const user = process.env.GMAIL_USER;
const pass = process.env.GMAIL_APP_PASSWORD;

if (!user || !pass) {
  console.error('ERROR: GMAIL_USER or GMAIL_APP_PASSWORD not found in .env.local');
  console.error('  GMAIL_USER      :', user  || '(missing)');
  console.error('  GMAIL_APP_PASSWORD:', pass ? `${pass.slice(0,4)}****` : '(missing)');
  process.exit(1);
}

console.log('GMAIL_USER        :', user);
console.log('GMAIL_APP_PASSWORD:', `${pass.slice(0,4)}${'*'.repeat(pass.length - 4)} (${pass.length} chars)`);
console.log('');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user, pass },
});

async function run() {
  // 1. Verify the credentials against Gmail SMTP without sending
  console.log('--- Step 1: verifying credentials (SMTP EHLO + AUTH) ---');
  try {
    await transporter.verify();
    console.log('✓ Credentials accepted by Gmail SMTP');
  } catch (err) {
    console.error('✗ Credential verification FAILED');
    console.error('  message    :', err.message);
    console.error('  code       :', err.code);
    console.error('  responseCode:', err.responseCode);
    console.error('  response   :', err.response);
    console.error('');
    console.error('Common causes:');
    console.error('  EAUTH 535 — wrong App Password, or 2FA not enabled on the Gmail account');
    console.error('  EAUTH 534 — "Less secure app access" required (legacy accounts only)');
    console.error('  ECONNECTION — network / firewall blocking port 465/587');
    console.error('');
    console.error('Fix: go to https://myaccount.google.com/apppasswords and regenerate the App Password.');
    console.error('     The account MUST have 2-Step Verification enabled first.');
    process.exit(1);
  }

  // 2. Send a real test email
  console.log('');
  console.log('--- Step 2: sending test email to abhinav@bricksofindia.com ---');
  try {
    const info = await transporter.sendMail({
      from: `"BOI Email Test" <${user}>`,
      replyTo: user,
      to: 'abhinav@bricksofindia.com',
      subject: '[BOI test] SMTP working — ' + new Date().toISOString(),
      text: 'If you received this, GMAIL_USER and GMAIL_APP_PASSWORD are correct and SMTP is working.',
    });
    console.log('✓ Email sent successfully');
    console.log('  messageId  :', info.messageId);
    console.log('  accepted   :', info.accepted);
    console.log('  rejected   :', info.rejected);
    console.log('  response   :', info.response);
  } catch (err) {
    console.error('✗ Send FAILED');
    console.error('  message    :', err.message);
    console.error('  code       :', err.code);
    console.error('  responseCode:', err.responseCode);
    console.error('  response   :', err.response);
    process.exit(1);
  }
}

run();
