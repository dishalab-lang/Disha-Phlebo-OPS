import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || '587');
    const user = process.env.SMTP_USER || 'PHLEBO.DISHA@GMAIL.COM';
    const pass = process.env.SMTP_PASS || 'Phlebo@123';

    if (!user || !pass) {
      console.warn('SMTP credentials not fully configured. Email sending will be disabled.');
      return null;
    }

    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // true for 465, false for other ports
      auth: {
        user,
        pass,
      },
    });
  }
  return transporter;
}

export async function sendEmail(to: string, subject: string, text: string, html?: string) {
  const client = getTransporter();
  if (!client) {
    console.log('Email not sent: SMTP not configured.');
    return;
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'PHLEBO.DISHA@GMAIL.COM';

  try {
    const info = await client.sendMail({
      from: `"Disha Phlebo" <${from}>`,
      to,
      subject,
      text,
      html,
    });
    console.log('Email sent: %s', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}
