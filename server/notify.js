const nodemailer = require('nodemailer');
const { getAllSettings } = require('./db/queries');

function buildTransport(settings) {
  const host = settings.smtp_host;
  const port = settings.smtp_port ? parseInt(settings.smtp_port, 10) : 587;
  const user = settings.smtp_user;
  const pass = settings.smtp_pass;
  if (!host || !user) return null;
  return nodemailer.createTransport({
    host,
    port,
    secure: settings.smtp_secure === 'true' || port === 465,
    auth: { user, pass: pass || '' },
  });
}

async function notifyPotentialMatch({ itemName, platform, title, url, matchScore }) {
  const settings = getAllSettings();
  const to = settings.notification_email;
  if (!to) {
    console.log('[notify] No notification_email in settings; would alert:', { itemName, platform, title, matchScore });
    return;
  }

  const transport = buildTransport(settings);
  const subject = `[RecoverWatch] ${matchScore === 'high' ? 'High' : 'Possible'} match: ${itemName}`;

  const text = `
RecoverWatch found a listing that may match your registered item "${itemName}".

Match level: ${matchScore}
Platform: ${platform}
Title: ${title}
URL: ${url}

Open RecoverWatch to review this listing.
`.trim();

  if (!transport) {
    console.log('[notify] SMTP not configured; email would be sent to', to);
    console.log(text);
    return;
  }

  try {
    await transport.sendMail({
      from: settings.smtp_from || settings.smtp_user,
      to,
      subject,
      text,
    });
    console.log('[notify] Email sent to', to);
  } catch (err) {
    console.error('[notify] Failed to send email:', err.message);
  }
}

module.exports = { notifyPotentialMatch };
