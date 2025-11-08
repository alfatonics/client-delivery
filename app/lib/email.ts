import nodemailer from "nodemailer";

type MailerConfig = {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
};

type SendEmailOptions = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  cc?: string | string[];
};

const COMPANY_NAME = "Alfatonics";
const COMPANY_WEBSITE =
  process.env.COMPANY_WEBSITE || "https://www.alfatonics.com";
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "support@alfatonics.com";
const SUPPORT_PHONE = process.env.SUPPORT_PHONE || "+255 656 586 676";

const APP_BASE_URL =
  process.env.APP_BASE_URL ||
  process.env.NEXTAUTH_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  COMPANY_WEBSITE;

const LOGIN_PATH = "/auth/signin";

let cachedConfig: MailerConfig | null = null;
let cachedTransporter: nodemailer.Transporter | null = null;

function resolveMailerConfig(): MailerConfig {
  if (cachedConfig) return cachedConfig;

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT
    ? Number(process.env.SMTP_PORT)
    : undefined;
  const from = process.env.EMAIL_FROM;

  if (!host || !port || Number.isNaN(port)) {
    throw new Error(
      "Missing SMTP configuration. Ensure SMTP_HOST and SMTP_PORT are set."
    );
  }

  if (!from) {
    throw new Error("Missing EMAIL_FROM environment variable.");
  }

  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD || process.env.SMTP_PASS;

  cachedConfig = {
    host,
    port,
    secure: port === 465,
    user,
    pass,
    from,
  };

  return cachedConfig;
}

function getTransporter(): nodemailer.Transporter {
  if (cachedTransporter) return cachedTransporter;
  const config = resolveMailerConfig();

  cachedTransporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth:
      config.user && config.pass
        ? {
            user: config.user,
            pass: config.pass,
          }
        : undefined,
  });

  return cachedTransporter;
}

export async function sendEmail(options: SendEmailOptions) {
  const transporter = getTransporter();
  const config = resolveMailerConfig();

  await transporter.sendMail({
    from: config.from,
    to: options.to,
    cc: options.cc,
    subject: options.subject,
    html: options.html,
    text: options.text,
  });
}

function formatGreeting(name?: string | null) {
  if (!name || name.trim().length === 0) {
    return "Hello";
  }
  return `Hello ${name.trim()}`;
}

function buildEmailShell(content: string, footer?: string) {
  const sanitizedPhone = SUPPORT_PHONE.replace(/[^\d+]/g, "");

  const defaultFooter = `
    <a href="${COMPANY_WEBSITE}" style="color:#f5f7fb;text-decoration:none;font-weight:600;">${COMPANY_NAME}</a>
    &nbsp;·&nbsp;
    <a href="${COMPANY_WEBSITE}" style="color:#f5f7fb;text-decoration:none;">${COMPANY_WEBSITE}</a>
    &nbsp;·&nbsp;
    <a href="tel:${sanitizedPhone}" style="color:#f5f7fb;text-decoration:none;">${SUPPORT_PHONE}</a>
    &nbsp;·&nbsp;
    <a href="mailto:${SUPPORT_EMAIL}" style="color:#f5f7fb;text-decoration:none;">${SUPPORT_EMAIL}</a>
  `;

  const resolvedFooter = footer || defaultFooter;

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f5f7;padding:32px 0;font-family:Arial,sans-serif;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background-color:#ffffff;border-radius:12px;box-shadow:0 10px 25px rgba(15,23,42,0.08);overflow:hidden;">
            <tr>
              <td style="background:linear-gradient(135deg,#3c5495 0%,#e98923 100%);padding:28px 36px;color:#ffffff;">
                <h1 style="margin:0;font-size:26px;font-weight:600;">${COMPANY_NAME} Client Delivery</h1>
                <p style="margin:8px 0 0;font-size:15px;opacity:0.9;">Professional content delivery platform</p>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 36px 28px;color:#1f2937;font-size:15px;line-height:1.6;">
                ${content}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 36px;background-color:#3c5495;color:#f5f7fb;font-size:13px;text-align:center;">
                ${resolvedFooter}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

export async function sendUserCredentialsEmail(options: {
  to: string;
  name?: string | null;
  role: "ADMIN" | "STAFF" | "CLIENT";
  email: string;
  password: string;
}) {
  const loginUrl = new URL(LOGIN_PATH, APP_BASE_URL).toString();
  const roleLabel =
    options.role === "STAFF"
      ? "Team Member"
      : options.role === "CLIENT"
      ? "Client"
      : "Administrator";

  const htmlContent = `
    <p style="margin:0 0 16px;">${formatGreeting(options.name)},</p>
    <p style="margin:0 0 16px;">
      You now have a ${roleLabel.toLowerCase()} account on the Alfatonics client delivery portal.
      Use the credentials below to access your dashboard and keep your projects moving.
    </p>
    <div style="margin:24px 0;padding:18px 24px;border:1px solid #d8def4;border-radius:10px;background:#f4f6ff;">
      <p style="margin:0 0 12px;font-weight:600;">Account details</p>
      <p style="margin:0;font-family:'SFMono-Regular',Menlo,monospace;font-size:14px;">
        Email: <strong>${options.email}</strong><br/>
        Temporary password: <strong>${options.password}</strong>
      </p>
    </div>
    <p style="margin:0 0 16px;">Next steps:</p>
    <ol style="margin:0 0 16px 20px;padding:0;">
      <li style="margin:0 0 8px;">Visit <a href="${loginUrl}" style="color:#e98923;text-decoration:none;">${loginUrl}</a></li>
      <li style="margin:0 0 8px;">Sign in with the credentials above</li>
      <li style="margin:0 0 8px;">Update your password from the profile menu after your first login</li>
    </ol>
    <p style="margin:0 0 16px;">
      For assistance, reply to this email or call us at <strong>${SUPPORT_PHONE}</strong>.
    </p>
    <p style="margin:0;">We’re excited to have you on board,<br/>The ${COMPANY_NAME} Team</p>
  `;

  const textContent = `${formatGreeting(options.name)},

You now have a ${roleLabel.toLowerCase()} account on the Alfatonics client delivery portal.

Account details:
- Email: ${options.email}
- Temporary password: ${options.password}

Next steps:
1. Visit ${loginUrl}
2. Sign in with the credentials above
3. Update your password from the profile menu after your first login

Need help? Call ${SUPPORT_PHONE} or reply to this email.

The ${COMPANY_NAME} Team`;

  await sendEmail({
    to: options.to,
    subject: "Your Alfatonics Client Delivery account is ready",
    html: buildEmailShell(htmlContent),
    text: textContent,
  });
}

export async function sendProjectCompletionEmail(options: {
  to: string;
  cc?: string | string[] | null;
  name?: string | null;
  projectTitle?: string | null;
  projectId: string;
  loginEmail?: string;
  loginPassword?: string;
}) {
  const projectLabel =
    options.projectTitle && options.projectTitle.trim().length > 0
      ? options.projectTitle.trim()
      : `Project ${options.projectId.slice(0, 8).toUpperCase()}`;

  const projectUrl = new URL(
    `/client/projects/${options.projectId}`,
    APP_BASE_URL
  ).toString();

  const htmlContent = `
    <p style="margin:0 0 16px;">${formatGreeting(options.name)},</p>
    <p style="margin:0 0 16px;">
      Great news! The final files for <strong>${projectLabel}</strong> are now ready.
      You can securely download your deliverables from the Alfatonics client delivery portal.
    </p>
    <div style="margin:24px 0;padding:18px 24px;border:1px solid #d8def4;border-radius:10px;background:#f4f6ff;">
      <p style="margin:0 0 12px;font-weight:600;">Download instructions</p>
      <ol style="margin:0;padding-left:20px;">
        <li style="margin:0 0 8px;">Sign in at <a href="${projectUrl}" style="color:#e98923;text-decoration:none;">${projectUrl}</a></li>
        <li style="margin:0 0 8px;">Open the project named <strong>${projectLabel}</strong></li>
        <li style="margin:0 0 8px;">Locate the Deliverables section and download your files</li>
      </ol>
    </div>
    ${
      options.loginEmail && options.loginPassword
        ? `
    <div style="margin:24px 0;padding:18px 24px;border:1px solid #d8def4;border-radius:10px;background:#f4f6ff;">
      <p style="margin:0 0 12px;font-weight:600;">Your login credentials</p>
      <p style="margin:0;font-family:'SFMono-Regular',Menlo,monospace;font-size:14px;">
        Email: <strong>${options.loginEmail}</strong><br/>
        Password: <strong>${options.loginPassword}</strong>
      </p>
      <p style="margin:12px 0 0;font-size:13px;color:#3c5495;">
        For security, we recommend changing the password after your next login.
      </p>
    </div>
    `
        : ""
    }
    <p style="margin:0 0 16px;">
      If you have any questions or need edits, reach out at <strong>${SUPPORT_PHONE}</strong> or visit <a href="${COMPANY_WEBSITE}" style="color:#e98923;text-decoration:none;">${COMPANY_WEBSITE}</a>.
    </p>
    <p style="margin:0;">Thank you for trusting ${COMPANY_NAME},<br/>We appreciate your business.</p>
  `;

  const textContent = `${formatGreeting(options.name)},

The final files for ${projectLabel} are ready.

${
  options.loginEmail && options.loginPassword
    ? `Login credentials:\n- Email: ${options.loginEmail}\n- Password: ${options.loginPassword}\n\n`
    : ""
}
Download instructions:
1. Sign in at ${projectUrl}
2. Open the project named "${projectLabel}"
3. Locate the Deliverables section and download your files

Need help or adjustments? Call ${SUPPORT_PHONE} or visit ${COMPANY_WEBSITE}.

Thank you for working with ${COMPANY_NAME}.`;

  await sendEmail({
    to: options.to,
    cc: options.cc || undefined,
    subject: `Your ${projectLabel} deliverables are ready`,
    html: buildEmailShell(htmlContent),
    text: textContent,
  });
}

export async function sendProjectAssignmentEmail(options: {
  to: string;
  staffName?: string | null;
  projectTitle?: string | null;
  projectId: string;
  clientName?: string | null;
  clientEmail?: string | null;
  createdByName?: string | null;
  notes?: string | null;
}) {
  const projectLabel =
    options.projectTitle && options.projectTitle.trim().length > 0
      ? options.projectTitle.trim()
      : `Project ${options.projectId.slice(0, 8).toUpperCase()}`;

  const staffProjectUrl = new URL(
    `/staff/projects/${options.projectId}`,
    APP_BASE_URL
  ).toString();

  const clientLine =
    options.clientName || options.clientEmail
      ? `<li style="margin:0 0 8px;">
            Client: <strong>${[options.clientName, options.clientEmail]
              .filter(Boolean)
              .join(" · ")}</strong>
          </li>`
      : "";

  const adminLine = options.createdByName
    ? `<li style="margin:0 0 8px;">
          Assigned by: <strong>${options.createdByName}</strong>
        </li>`
    : "";

  const notesBlock =
    options.notes && options.notes.trim().length > 0
      ? `<div style="margin:24px 0;padding:18px 24px;border:1px solid #d8def4;border-radius:10px;background:#f4f6ff;">
          <p style="margin:0 0 12px;font-weight:600;">Additional context</p>
          <p style="margin:0;white-space:pre-wrap;">${options.notes
            .trim()
            .replace(
              /\n/g,
              "<br/>"
            )}</p>
        </div>`
      : "";

  const htmlContent = `
    <p style="margin:0 0 16px;">${formatGreeting(options.staffName)},</p>
    <p style="margin:0 0 16px;">
      You’ve been assigned to <strong>${projectLabel}</strong> in the Alfatonics client delivery portal.
      Please review the brief and begin work at your earliest convenience.
    </p>
    <div style="margin:24px 0;padding:18px 24px;border:1px solid #d8def4;border-radius:10px;background:#f4f6ff;">
      <p style="margin:0 0 12px;font-weight:600;">Project details</p>
      <ul style="margin:0;padding-left:20px;">
        <li style="margin:0 0 8px;">
          Project: <strong>${projectLabel}</strong>
        </li>
        ${clientLine}
        ${adminLine}
        <li style="margin:0 0 8px;">
          Portal link: <a href="${staffProjectUrl}" style="color:#e98923;text-decoration:none;">${staffProjectUrl}</a>
        </li>
      </ul>
    </div>
    ${notesBlock}
    <p style="margin:0 0 16px;">
      If you have any questions or need more context, please reach out to the admin team or reply to this email.
    </p>
    <p style="margin:0;">
      Thank you,<br/>The ${COMPANY_NAME} Team
    </p>
  `;

  const textLines = [
    `${formatGreeting(options.staffName)},`,
    "",
    `You’ve been assigned to ${projectLabel} in the Alfatonics client delivery portal.`,
  ];

  if (options.clientName || options.clientEmail) {
    textLines.push(
      "",
      "Client:",
      `- ${[options.clientName, options.clientEmail].filter(Boolean).join(
        " · "
      )}`
    );
  }

  if (options.createdByName) {
    textLines.push("", `Assigned by: ${options.createdByName}`);
  }

  textLines.push(
    "",
    `Portal link: ${staffProjectUrl}`,
    ""
  );

  if (options.notes && options.notes.trim().length > 0) {
    textLines.push("Additional context:", options.notes.trim(), "");
  }

  textLines.push(
    "Need anything else? Reply to this email or contact the admin team.",
    "",
    `The ${COMPANY_NAME} Team`
  );

  const textContent = textLines.join("\n");

  await sendEmail({
    to: options.to,
    subject: `${projectLabel}: New assignment for you`,
    html: buildEmailShell(htmlContent),
    text: textContent,
  });
}
