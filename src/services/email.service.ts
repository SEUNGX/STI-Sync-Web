/**
 * src/services/email.service.ts
 *
 * App-wide Resend Email Service for STI Sync.
 * Handles transactional emails, event approval status updates, and notifications.
 */

import axios from 'axios';
import emailjs from '@emailjs/browser';

export const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID || '';
export const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || '';
export const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || '';

export const RESEND_API_KEY = import.meta.env.VITE_RESEND_API_KEY || '';

export const RESEND_FROM_EMAIL =
  import.meta.env.VITE_RESEND_FROM_EMAIL || 'STI Sync <onboarding@resend.dev>';

const getResendEndpoint = () => {
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return '/api/resend/emails';
  }
  return import.meta.env.VITE_RESEND_API_URL || 'https://api.resend.com/emails';
};

export interface SendEmailPayload {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  recipientName?: string;
  templateParams?: Record<string, any>;
}

export interface EmailResponse {
  id?: string;
  status?: number;
  text?: string;
  error?: {
    message: string;
    name?: string;
  };
}

export type ResendResponse = EmailResponse;

/**
 * Core helper to send emails via EmailJS (if configured) or Resend API
 */
export async function sendEmail(payload: SendEmailPayload): Promise<EmailResponse> {
  const { to, subject, html, text, from, replyTo, recipientName, templateParams } = payload;
  const effectiveReplyTo = replyTo || 'leiconcordia2005@gmail.com';
  const recipients = Array.isArray(to) ? to : [to];

  // ── 1. If EmailJS is configured, send via EmailJS (Direct Gmail OAuth) ──
  if (EMAILJS_PUBLIC_KEY && EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID) {
    try {
      const recipientString = recipients.join(', ');
      const recipientNameString = recipientName || 'STI Sync User';

      const emailjsRes = await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
          to_email: recipientString,
          email: recipientString,
          user_email: recipientString,
          recipient: recipientString,
          to: recipientString,
          to_name: recipientNameString,
          name: recipientNameString,
          user_name: recipientNameString,
          adviser_name: recipientNameString,
          officer_name: recipientNameString,
          subject: subject,
          html_content: html || '',
          html: html || '',
          message: text || '',
          reply_to: effectiveReplyTo,
          ...(templateParams || {}),
        },
        EMAILJS_PUBLIC_KEY
      );

      console.log('[EmailService] EmailJS sent successfully:', emailjsRes);
      return {
        id: `emailjs-${Date.now()}`,
        status: emailjsRes.status,
        text: emailjsRes.text,
      };
    } catch (ejsErr: any) {
      console.error('[EmailService] EmailJS dispatch error:', ejsErr);
      throw new Error(ejsErr?.text || ejsErr?.message || 'Failed to send email via EmailJS');
    }
  }

  // ── 2. Otherwise send via Resend API ──
  const sender = from || RESEND_FROM_EMAIL;
  const endpoint = getResendEndpoint();

  try {
    const response = await axios.post<EmailResponse>(
      endpoint,
      {
        from: sender,
        to: recipients,
        subject,
        html,
        text,
        reply_to: effectiveReplyTo,
      },
      {
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error: any) {
    const errorMsg = error.response?.data?.message || error.message || 'Failed to send email';
    console.error('[EmailService] Error sending email via Resend:', errorMsg);
    throw new Error(errorMsg);
  }
}

/**
 * Helper: Send Event Proposal Approved Email Notification
 */
export async function sendEventApprovedEmail(params: {
  to: string;
  officerName: string;
  eventTitle: string;
  referenceId: string;
  remarks?: string;
}): Promise<ResendResponse> {
  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
      <div style="background-color: #001A4D; padding: 24px; text-align: center;">
        <h1 style="color: #FFD41C; margin: 0; font-size: 24px;">STI SYNC</h1>
        <p style="color: #ffffff; margin: 4px 0 0 0; font-size: 13px;">Student Affairs & Services</p>
      </div>
      <div style="padding: 32px;">
        <h2 style="color: #22C55E; margin-top: 0;">✓ Event Proposal Approved!</h2>
        <p style="color: #333333; font-size: 15px; line-height: 1.6;">Hello <strong>${params.officerName}</strong>,</p>
        <p style="color: #333333; font-size: 15px; line-height: 1.6;">
          Great news! Your event proposal <strong>"${params.eventTitle}"</strong> (Ref ID: <code>${params.referenceId}</code>) has been officially <strong>APPROVED</strong> by SAO Administration.
        </p>
        ${params.remarks ? `
          <div style="background-color: #f4f6f8; border-left: 4px solid #0E4EBD; padding: 16px; margin: 20px 0; border-radius: 6px;">
            <p style="margin: 0; font-weight: bold; color: #001A4D; font-size: 12px; text-transform: uppercase;">Adviser Remarks:</p>
            <p style="margin: 6px 0 0 0; color: #444444; font-style: italic; font-size: 14px;">"${params.remarks}"</p>
          </div>
        ` : ''}
        <p style="color: #666666; font-size: 14px; margin-top: 24px;">
          You can now view your approved event and manage attendance scanner codes from your STI Sync Officer Portal.
        </p>
      </div>
      <div style="background-color: #f9fafb; padding: 16px; text-align: center; border-top: 1px solid #e0e0e0; font-size: 12px; color: #888888;">
        © STI Sync — Campus Event & Organization Management System
      </div>
    </div>
  `;

  return sendEmail({
    to: params.to,
    subject: `[APPROVED] Event Proposal: ${params.eventTitle}`,
    recipientName: params.officerName,
    html,
  });
}

/**
 * Helper: Send Event Proposal Returned Email Notification
 */
export async function sendEventReturnedEmail(params: {
  to: string;
  officerName: string;
  eventTitle: string;
  referenceId: string;
  remarks: string;
}): Promise<ResendResponse> {
  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
      <div style="background-color: #001A4D; padding: 24px; text-align: center;">
        <h1 style="color: #FFD41C; margin: 0; font-size: 24px;">STI SYNC</h1>
        <p style="color: #ffffff; margin: 4px 0 0 0; font-size: 13px;">Student Affairs & Services</p>
      </div>
      <div style="padding: 32px;">
        <h2 style="color: #F59E0B; margin-top: 0;">↺ Event Proposal Returned for Revision</h2>
        <p style="color: #333333; font-size: 15px; line-height: 1.6;">Hello <strong>${params.officerName}</strong>,</p>
        <p style="color: #333333; font-size: 15px; line-height: 1.6;">
          Your event proposal <strong>"${params.eventTitle}"</strong> (Ref ID: <code>${params.referenceId}</code>) has been returned by SAO Administration for requested revisions.
        </p>
        <div style="background-color: #fffbe6; border-left: 4px solid #F59E0B; padding: 16px; margin: 20px 0; border-radius: 6px;">
          <p style="margin: 0; font-weight: bold; color: #856404; font-size: 12px; text-transform: uppercase;">Revision Feedback / Instructions:</p>
          <p style="margin: 6px 0 0 0; color: #333333; font-size: 14px;">${params.remarks}</p>
        </div>
        <p style="color: #666666; font-size: 14px; margin-top: 24px;">
          Please log into STI Sync to update your proposal fields and resubmit for review.
        </p>
      </div>
      <div style="background-color: #f9fafb; padding: 16px; text-align: center; border-top: 1px solid #e0e0e0; font-size: 12px; color: #888888;">
        © STI Sync — Campus Event & Organization Management System
      </div>
    </div>
  `;

  return sendEmail({
    to: params.to,
    subject: `[REVISION REQUIRED] Event Proposal: ${params.eventTitle}`,
    recipientName: params.officerName,
    html,
  });
}

/**
 * Helper: Send Organization Adviser Welcome Credentials Email
 */
export async function sendAdviserWelcomeCredentialsEmail(params: {
  to: string;
  adviserName: string;
  orgName: string;
  employeeId?: string;
  temporaryPassword?: string;
  loginUrl?: string;
}): Promise<ResendResponse> {
  const loginUrl = params.loginUrl || `${window.location.origin}/welcome`;
  const tempPass = params.temporaryPassword || 'Adv-2026!#';

  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
      <div style="background-color: #001A4D; padding: 24px; text-align: center;">
        <h1 style="color: #FFD41C; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 0.5px;">STI SYNC</h1>
        <p style="color: #ffffff; margin: 4px 0 0 0; font-size: 13px;">Student Affairs & Services — Organization Management</p>
      </div>
      <div style="padding: 32px;">
        <h2 style="color: #001A4D; margin-top: 0; font-size: 20px;">Welcome, Club Adviser!</h2>
        <p style="color: #333333; font-size: 15px; line-height: 1.6;">Dear <strong>${params.adviserName}</strong>,</p>
        <p style="color: #333333; font-size: 15px; line-height: 1.6;">
          You have been registered as the official <strong>Club Adviser</strong> for <strong>${params.orgName}</strong> on the STI Sync Platform.
        </p>

        <div style="background-color: #f4f6fb; border: 1.5px solid #d0d7e8; padding: 20px; margin: 24px 0; border-radius: 8px;">
          <h3 style="margin: 0 0 12px 0; color: #001A4D; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Your Login Credentials</h3>
          <p style="margin: 4px 0; font-size: 14px; color: #333333;"><strong>Portal:</strong> Officer & Adviser Web Portal</p>
          <p style="margin: 4px 0; font-size: 14px; color: #333333;"><strong>Email / Identifier:</strong> <code style="background-color: #e8ecf4; padding: 2px 6px; border-radius: 4px; color: #0E4EBD;">${params.to}</code></p>
          ${params.employeeId ? `<p style="margin: 4px 0; font-size: 14px; color: #333333;"><strong>Employee ID:</strong> ${params.employeeId}</p>` : ''}
          <p style="margin: 4px 0; font-size: 14px; color: #333333;"><strong>Temporary Password:</strong> <code style="background-color: #fff3cd; color: #856404; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 15px;">${tempPass}</code></p>
        </div>

        <div style="background-color: #fff8e1; border-left: 4px solid #FFC107; padding: 12px 16px; margin-bottom: 24px; border-radius: 4px;">
          <p style="margin: 0; color: #856404; font-size: 13px; line-height: 1.5;">
            <strong>Security Notice:</strong> For your security, you will be prompted to change your temporary password immediately upon your first login.
          </p>
        </div>

    

        <p style="color: #666666; font-size: 13px; line-height: 1.5; margin-top: 24px;">
          As Club Adviser, you have administrative access to manage your organization, appoint student officers from the student directory, and review event proposals.
        </p>
      </div>
      <div style="background-color: #f9fafb; padding: 16px; text-align: center; border-top: 1px solid #e0e0e0; font-size: 12px; color: #888888;">
        © STI Sync — Campus Event & Organization Management System
      </div>
    </div>
  `;

  return sendEmail({
    to: params.to,
    subject: `[STI Sync] Welcome as Club Adviser for ${params.orgName} — Login Credentials`,
    recipientName: params.adviserName,
    html,
    text: `Welcome, ${params.adviserName}! You have been registered as the official Club Adviser for ${params.orgName}.\n\nLogin Identifier: ${params.to}\nEmployee ID: ${params.employeeId || 'N/A'}\nTemporary Password: ${tempPass}\n\nAccess the portal: ${loginUrl}`,
    templateParams: {
      to_email: params.to,
      email: params.to,
      to_name: params.adviserName,
      name: params.adviserName,
      adviser_name: params.adviserName,
      org_name: params.orgName,
      organization_name: params.orgName,
      employee_id: params.employeeId || '',
      temp_password: tempPass,
      temporary_password: tempPass,
      password: tempPass,
      login_url: loginUrl,
      link: loginUrl,
      message: `You have been registered as the official Club Adviser for ${params.orgName}. Your Login Email is ${params.to} and your Temporary Password is: ${tempPass}`,
    },
  });
}

/**
 * Helper: Send Officer Appointment Notification Email
 */
export async function sendOfficerAppointmentEmail(params: {
  to: string;
  officerName: string;
  orgName: string;
  roleName: string;
  studentId?: string;
  loginUrl?: string;
}): Promise<ResendResponse> {
  const loginUrl = params.loginUrl || `${window.location.origin}/welcome`;

  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
      <div style="background-color: #001A4D; padding: 24px; text-align: center;">
        <h1 style="color: #FFD41C; margin: 0; font-size: 24px; font-weight: 800;">STI SYNC</h1>
        <p style="color: #ffffff; margin: 4px 0 0 0; font-size: 13px;">Student Affairs & Services — Officer Executive Board</p>
      </div>
      <div style="padding: 32px;">
        <h2 style="color: #0E4EBD; margin-top: 0; font-size: 20px;">Congratulations on Your Appointment!</h2>
        <p style="color: #333333; font-size: 15px; line-height: 1.6;">Hello <strong>${params.officerName}</strong>,</p>
        <p style="color: #333333; font-size: 15px; line-height: 1.6;">
          You have been officially appointed as <strong>${params.roleName}</strong> for <strong>${params.orgName}</strong> on the STI Sync Platform.
        </p>

        <div style="background-color: #f4f6fb; border: 1.5px solid #d0d7e8; padding: 20px; margin: 24px 0; border-radius: 8px;">
          <h3 style="margin: 0 0 12px 0; color: #001A4D; font-size: 14px; text-transform: uppercase;">Officer Portal Access</h3>
          <p style="margin: 4px 0; font-size: 14px; color: #333333;"><strong>Organization:</strong> ${params.orgName}</p>
          <p style="margin: 4px 0; font-size: 14px; color: #333333;"><strong>Designated Role:</strong> <span style="color: #0E4EBD; font-weight: bold;">${params.roleName}</span></p>
          <p style="margin: 4px 0; font-size: 14px; color: #333333;"><strong>Login Account:</strong> Log in using your existing <strong>STI Student Credentials</strong> (Student ID / Student Email & Password).</p>
        </div>

        <div style="text-align: center; margin: 28px 0 16px 0;">
          <a href="${loginUrl}" style="background-color: #001A4D; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">
            Open Officer Portal &rarr;
          </a>
        </div>

        <p style="color: #666666; font-size: 13px; line-height: 1.5; margin-top: 24px;">
          You now have access to create and manage event proposals, review attendance logs, manage club members, and coordinate organizational finances.
        </p>
      </div>
      <div style="background-color: #f9fafb; padding: 16px; text-align: center; border-top: 1px solid #e0e0e0; font-size: 12px; color: #888888;">
        © STI Sync — Campus Event & Organization Management System
      </div>
    </div>
  `;

  return sendEmail({
    to: params.to,
    subject: `[STI Sync] Official Appointment: ${params.roleName} — ${params.orgName}`,
    recipientName: params.officerName,
    html,
    text: `Hello ${params.officerName},\n\nYou have been officially appointed as ${params.roleName} for ${params.orgName} on the STI Sync Platform.\n\nLog in using your existing STI Student Credentials at: ${loginUrl}`,
    templateParams: {
      to_email: params.to,
      email: params.to,
      to_name: params.officerName,
      name: params.officerName,
      officer_name: params.officerName,
      org_name: params.orgName,
      organization_name: params.orgName,
      role_name: params.roleName,
      student_id: params.studentId || '',
      login_url: loginUrl,
      link: loginUrl,
      message: `You have been officially appointed as ${params.roleName} for ${params.orgName}. Log in using your existing STI Student Credentials.`,
    },
  });
}

/**
 * Helper: Send Student Manual Registration Welcome & Temporary Credentials Email
 */
export async function sendStudentWelcomeCredentialsEmail(params: {
  to: string;
  studentName: string;
  studentId: string;
  temporaryPassword?: string;
  courseName: string;
  yearLevel: string;
  section: string;
  loginUrl?: string;
}): Promise<ResendResponse> {
  const loginUrl = params.loginUrl || `${window.location.origin}/welcome`;
  const tempPass = params.temporaryPassword || 'STI-Student2026!';

  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
      <div style="background-color: #001A4D; padding: 24px; text-align: center;">
        <h1 style="color: #FFD41C; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 0.5px;">STI SYNC</h1>
        <p style="color: #ffffff; margin: 4px 0 0 0; font-size: 13px;">Student Affairs & Services — Student Account Registration</p>
      </div>
      <div style="padding: 32px;">
        <h2 style="color: #001A4D; margin-top: 0; font-size: 20px;">Welcome to STI Sync!</h2>
        <p style="color: #333333; font-size: 15px; line-height: 1.6;">Dear <strong>${params.studentName}</strong>,</p>
        <p style="color: #333333; font-size: 15px; line-height: 1.6;">
          Your official STI Sync student account has been created by the SAO Administrator. You can now log into the <strong>STI Sync Mobile App</strong> and web portal to view campus events, track attendance, and manage club memberships.
        </p>

        <div style="background-color: #f4f6fb; border: 1.5px solid #d0d7e8; padding: 20px; margin: 24px 0; border-radius: 8px;">
          <h3 style="margin: 0 0 12px 0; color: #001A4D; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Your Account Credentials</h3>
          <p style="margin: 4px 0; font-size: 14px; color: #333333;"><strong>Student ID:</strong> <span style="color: #001A4D; font-weight: bold;">${params.studentId}</span></p>
          <p style="margin: 4px 0; font-size: 14px; color: #333333;"><strong>Login Email:</strong> <code style="background-color: #e8ecf4; padding: 2px 6px; border-radius: 4px; color: #0E4EBD;">${params.to}</code></p>
          <p style="margin: 4px 0; font-size: 14px; color: #333333;"><strong>Temporary Password:</strong> <code style="background-color: #fff3cd; color: #856404; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 15px;">${tempPass}</code></p>
          <p style="margin: 4px 0; font-size: 13px; color: #666666;"><strong>Program & Section:</strong> ${params.courseName} · ${params.yearLevel} - ${params.section}</p>
        </div>

        <div style="background-color: #fff8e1; border-left: 4px solid #FFC107; padding: 12px 16px; margin-bottom: 24px; border-radius: 4px;">
          <p style="margin: 0; color: #856404; font-size: 13px; line-height: 1.5;">
            <strong>Mandatory Password Change:</strong> For your security, you will be required to change this temporary password immediately upon your first login in the STI Sync Mobile App or Web Portal.
          </p>
        </div>



        <p style="color: #666666; font-size: 13px; line-height: 1.5; margin-top: 24px;">
          If you have any questions or did not request this account, please visit the Student Affairs Office (SAO).
        </p>
      </div>
      <div style="background-color: #f9fafb; padding: 16px; text-align: center; border-top: 1px solid #e0e0e0; font-size: 12px; color: #888888;">
        © STI Sync — Campus Event & Student Affairs Management System
      </div>
    </div>
  `;

  return sendEmail({
    to: params.to,
    subject: `[STI Sync] Welcome ${params.studentName} — Your Student Account Credentials`,
    recipientName: params.studentName,
    html,
    text: `Welcome to STI Sync, ${params.studentName}!\n\nYour account has been created by SAO.\n\nStudent ID: ${params.studentId}\nLogin Email: ${params.to}\nTemporary Password: ${tempPass}\nProgram: ${params.courseName} (${params.yearLevel} - ${params.section})\n\nPlease change your temporary password upon first login at: ${loginUrl}`,
    templateParams: {
      to_email: params.to,
      email: params.to,
      to_name: params.studentName,
      name: params.studentName,
      student_name: params.studentName,
      student_id: params.studentId,
      temp_password: tempPass,
      temporary_password: tempPass,
      password: tempPass,
      course_name: params.courseName,
      year_level: params.yearLevel,
      section: params.section,
      login_url: loginUrl,
      link: loginUrl,
      message: `Your student account has been created on STI Sync. Your Login Email is ${params.to}, Student ID is ${params.studentId}, and Temporary Password is: ${tempPass}. Please change your password upon first login.`,
    },
  });
}

