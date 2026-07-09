import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || '587');
    const user = process.env.SMTP_USER || 'phlebo.disha@gmail.com';
    const pass = process.env.SMTP_PASS || 'pbod zhgf jlyc dzsd';

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

  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'phlebo.disha@gmail.com';

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
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Error sending email via SMTP:', error);
    
    // Add helpful guidance for common Gmail security & authentication failures
    if (errMsg.includes('535') || errMsg.match(/auth|login/i)) {
      return { 
        error: `SMTP Authentication Failed: ${errMsg}. Setup Tip: If you are using Gmail (smtp.gmail.com), standard account passwords will be blocked. You must enable 2-Step Verification in your Google Account Settings page, create an "App Password" (16-character secure code), and set that App Password as your SMTP_PASS.` 
      };
    }
    return { error: errMsg };
  }
}
