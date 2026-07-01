/**
 * Simple Mail Service for sending OTPs.
 * 
 * In a real production app, you would use:
 * - Nodemailer with an SMTP provider (SendGrid, Mailgun, etc.)
 * - Firebase Extensions (Trigger Email)
 * - AWS SES
 */

/**
 * Send an OTP reset code to the user's email.
 */
export async function sendOTPEmail(email: string, code: string) {
  console.log(`📧 Sending OTP [${code}] to [${email}]`);
  
  // NOTE: In production, integrate your email provider here.
  // Example with logic:
  // const transporter = nodemailer.createTransport({...});
  // await transporter.sendMail({
  //   from: '"Recall.me" <no-reply@recall.me>',
  //   to: email,
  //   subject: "Your Password Reset Code",
  //   text: `Your password reset code is: ${code}`,
  //   html: `<b>Your password reset code is: ${code}</b>`
  // });

  return true;
}
