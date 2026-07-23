import nodemailer from 'nodemailer';
import { logger } from './logger.js';

interface NotifyPayload {
  ruleName: string;
  channelType: string;
  channelConfig: Record<string, any>;
  metricName: string;
  metricValue: number;
  condition: string;
  threshold: number;
  projectId: string;
  runId?: string;
}

export async function sendNotification(payload: NotifyPayload): Promise<string | null> {
  const { channelType, channelConfig } = payload;

  try {
    if (channelType === 'slack') {
      return await sendSlack(payload, channelConfig);
    }
    if (channelType === 'webhook') {
      return await sendWebhook(payload, channelConfig);
    }
    if (channelType === 'email') {
      return await sendEmail(payload, channelConfig);
    }
    logger.warn({ channelType }, 'Unknown alert channel type');
    return null;
  } catch (err: any) {
    logger.error({ err, channelType }, 'Failed to send notification');
    return err.message || 'Unknown error';
  }
}

async function sendSlack(payload: NotifyPayload, config: Record<string, any>): Promise<string | null> {
  const url = config.webhookUrl;
  if (!url) return 'No webhook URL configured';

  const text = [
    `*🚨 TenjinT6 Alert: ${payload.ruleName}*`,
    `Metric: \`${payload.metricName}\` = ${payload.metricValue}`,
    `Condition: ${payload.metricName} ${operatorLabel(payload.condition)} ${payload.threshold}`,
    payload.runId ? `Run: \`${payload.runId.slice(0, 8)}...\`` : '',
    `Project: \`${payload.projectId.slice(0, 8)}...\``,
  ].filter(Boolean).join('\n');

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, mrkdwn: true }),
  });
  if (!res.ok) return `Slack webhook returned ${res.status}`;
  return null;
}

async function sendWebhook(payload: NotifyPayload, config: Record<string, any>): Promise<string | null> {
  const url = config.url;
  if (!url) return 'No webhook URL configured';

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: 'alert.triggered',
      rule: payload.ruleName,
      metric: payload.metricName,
      value: payload.metricValue,
      condition: payload.condition,
      threshold: payload.threshold,
      runId: payload.runId,
      projectId: payload.projectId,
      timestamp: new Date().toISOString(),
    }),
  });
  if (!res.ok) return `Webhook returned ${res.status}`;
  return null;
}

async function sendEmail(payload: NotifyPayload, config: Record<string, any>): Promise<string | null> {
  let host = process.env.SMTP_HOST;
  let port = parseInt(process.env.SMTP_PORT || '587', 10);
  let user = process.env.SMTP_USER;
  let pass = process.env.SMTP_PASS;
  let from = process.env.SMTP_FROM || 'alerts@tenjint6.local';

  if (!host && payload.projectId) {
    try {
      const { prisma } = await import('./prisma.js');
      const project = await prisma.project.findUnique({ where: { id: payload.projectId } });
      if (project) {
        const smtp = typeof project.smtpConfig === 'string' ? JSON.parse(project.smtpConfig) : (project.smtpConfig || {});
        if (smtp.host) { host = smtp.host; port = smtp.port || 587; user = smtp.user; pass = smtp.pass; from = smtp.fromEmail || from; }
      }
    } catch { /* keep env fallback */ }
  }

  if (!host) return 'SMTP not configured (set SMTP_HOST env var or project SMTP config)';

  const recipients = config.recipients || config.to || '';
  if (!recipients) return 'No email recipients configured';

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });

  try {
    await transporter.sendMail({
      from,
      to: recipients.split(',').map((r: string) => r.trim()).filter(Boolean),
      subject: `[TenjinT6 Alert] ${payload.ruleName}`,
      text: [
        `Alert: ${payload.ruleName}`,
        `Metric: ${payload.metricName} = ${payload.metricValue}`,
        `Condition: ${payload.metricName} ${operatorLabel(payload.condition)} ${payload.threshold}`,
        payload.runId ? `Run ID: ${payload.runId}` : '',
        `Project: ${payload.projectId}`,
        `Time: ${new Date().toISOString()}`,
      ].filter(Boolean).join('\n'),
      html: [
        '<div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">',
        `<h2 style="color: #dc2626;">🚨 ${payload.ruleName}</h2>`,
        '<table style="width: 100%; border-collapse: collapse;">',
        `<tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px;">Metric</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: 600;">${payload.metricName} = <span style="color: #dc2626;">${payload.metricValue}</span></td></tr>`,
        `<tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px;">Condition</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-family: monospace;">${payload.metricName} ${operatorLabel(payload.condition)} ${payload.threshold}</td></tr>`,
        payload.runId ? `<tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 13px;">Run</td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-family: monospace; font-size: 12px;">${payload.runId}</td></tr>` : '',
        `<tr><td style="padding: 8px; color: #6b7280; font-size: 13px;">Time</td><td style="padding: 8px; font-size: 13px;">${new Date().toLocaleString()}</td></tr>`,
        '</table>',
        '<hr style="border: none; border-top: 1px solid #e5e7eb; margin-top: 16px;">',
        '<p style="color: #9ca3af; font-size: 11px;">Sent by TenjinT6 Performance Testing Platform</p>',
        '</div>',
      ].filter(Boolean).join('\n'),
    });

    logger.info({ recipients, ruleName: payload.ruleName }, 'Alert email sent');
    return null;
  } catch (err: any) {
    logger.error({ err, recipients }, 'Failed to send alert email');
    return err.message || 'Failed to send email';
  }
}

function operatorLabel(op: string): string {
  const map: Record<string, string> = { gt: '>', lt: '<', gte: '>=', lte: '<=', eq: '=' };
  return map[op] || op;
}
