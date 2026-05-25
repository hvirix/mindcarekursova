const nodemailer = require('nodemailer');

/** Escape text for safe interpolation into HTML (bodies and quoted attributes). */
function escapeHtml(text) {
  if (text == null || text === '') return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Prevent header injection in Subject lines. */
function sanitizeEmailSubjectSegment(text) {
  return String(text ?? '').replace(/[\r\n\u0000]/g, ' ');
}

const createTransporter = () => {
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('Email configuration not found. Email notifications will be disabled.');
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number.parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
};

const sendArticleNotification = async (recipientEmail, recipientName, article, transporter = null) => {
  const emailTransporter = transporter || createTransporter();
  if (!emailTransporter) return false;
  if (!recipientEmail || !recipientEmail.trim()) return false;

  try {
    const articlePathId = Number(article.id);
    const articleUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/article/${Number.isFinite(articlePathId) ? articlePathId : ''}`;
    const fromEmail = process.env.EMAIL_FROM || process.env.EMAIL_USER;
    if (!fromEmail) return false;

    const safeName = escapeHtml(recipientName || 'користувач');
    const safeTitle = escapeHtml(article.title);
    const safeDesc = article.description ? escapeHtml(article.description) : '';
    const safeUrl = escapeHtml(articleUrl);

    await emailTransporter.sendMail({
      from: `"MindCare Platform" <${fromEmail}>`,
      to: recipientEmail.trim(),
      subject: sanitizeEmailSubjectSegment(`Нова стаття: ${article.title}`),
      html: `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px}.header{background-color:#D32F2F;color:white;padding:20px;text-align:center;border-radius:8px 8px 0 0}.content{background-color:#f9f9f9;padding:30px;border-radius:0 0 8px 8px}.article-title{font-size:24px;font-weight:bold;color:#D32F2F;margin-bottom:15px}.footer{margin-top:30px;padding-top:20px;border-top:1px solid #ddd;font-size:12px;color:#999;text-align:center}</style></head><body><div class="header"><h1>MindCare Platform</h1></div><div class="content"><p>Вітаємо, ${safeName}!</p><p>Нова стаття на платформі:</p><div class="article-title">${safeTitle}</div>${safeDesc ? `<p>${safeDesc}</p>` : ''}<a href="${safeUrl}" style="display:inline-block;padding:12px 30px;background-color:#D32F2F;color:#ffffff;text-decoration:none;border-radius:6px;margin-top:20px;font-weight:bold;">Читати статтю</a><div class="footer"><p>&copy; ${new Date().getFullYear()} MindCare Platform.</p></div></div></body></html>`,
      text: `Вітаємо, ${recipientName || 'користувач'}!\n\n${article.title}\n\n${article.description || ''}\n\nЧитати статтю: ${articleUrl}`,
    });
    console.log(`Article notification email sent to ${recipientEmail}`);
    return true;
  } catch (error) {
    console.error(`Error sending email to ${recipientEmail}:`, error.message);
    return false;
  }
};

const notifyUsersAboutArticle = async article => {
  const prisma = require('../db');
  try {
    const users = await prisma.users.findMany({
      where: { emailNotifications: true, role: { not: 'admin' } },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    const validUsers = users.filter(u => u.email && u.email.trim().length > 0);
    if (validUsers.length === 0) return { successful: 0, failed: 0, total: 0 };

    const transporter = createTransporter();
    if (!transporter) return { successful: 0, failed: validUsers.length, total: validUsers.length };

    let successful = 0, failed = 0;
    for (const user of validUsers) {
      const name = user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email;
      try {
        const result = await sendArticleNotification(user.email, name, article, transporter);
        result ? successful++ : failed++;
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        failed++;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    return { successful, failed, total: validUsers.length };
  } catch (error) {
    console.error('Error notifying users about article:', error);
    return { successful: 0, failed: 0, total: 0, error: error.message };
  }
};

const sendArticleRejectionNotification = async (recipientEmail, recipientName, article, rejectionReason, transporter = null) => {
  const emailTransporter = transporter || createTransporter();
  if (!emailTransporter) return false;
  if (!recipientEmail || !recipientEmail.trim()) return false;

  try {
    const editPathId = Number(article.id);
    const articleEditUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/articles/${Number.isFinite(editPathId) ? editPathId : ''}/edit`;
    const fromEmail = process.env.EMAIL_FROM || process.env.EMAIL_USER;
    if (!fromEmail) return false;

    const safeName = escapeHtml(recipientName || 'користувач');
    const safeTitle = escapeHtml(article.title);
    const safeReason = escapeHtml(rejectionReason || 'Причина не вказана');
    const safeEditUrl = escapeHtml(articleEditUrl);

    await emailTransporter.sendMail({
      from: `"MindCare Platform" <${fromEmail}>`,
      to: recipientEmail,
      subject: sanitizeEmailSubjectSegment('Вашу статтю відхилено на модерації'),
      html: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><h1>MindCare Platform</h1><p>Вітаємо, ${safeName}!</p><p>На жаль, вашу статтю "<strong>${safeTitle}</strong>" було відхилено.</p><p><strong>Причина відхилення:</strong> ${safeReason}</p><p><a href="${safeEditUrl}">Редагувати статтю</a></p><p>&copy; ${new Date().getFullYear()} MindCare Platform.</p></body></html>`,
      text: `Вітаємо, ${recipientName || 'користувач'}!\n\nВашу статтю "${article.title}" відхилено.\n\nПричина: ${rejectionReason || 'Причина не вказана'}\n\nРедагувати: ${articleEditUrl}`,
    });
    console.log(`Article rejection email sent to ${recipientEmail}`);
    return true;
  } catch (error) {
    console.error(`Error sending rejection email to ${recipientEmail}:`, error.message);
    return false;
  }
};

const sendAppointmentNotificationEmail = async ({ psychologistEmail, psychologistName, patientName, appointmentDateTime, transporter = null }) => {
  const emailTransporter = transporter || createTransporter();
  if (!emailTransporter) return false;
  if (!psychologistEmail || !psychologistEmail.trim()) return false;

  try {
    const fromEmail = process.env.EMAIL_FROM || process.env.EMAIL_USER;
    if (!fromEmail) return false;

    const appointmentDate = new Date(appointmentDateTime);
    const formattedDate = appointmentDate.toLocaleDateString('uk-UA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const formattedTime = appointmentDate.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });

    const safePsych = escapeHtml(psychologistName || 'користувач');
    const safePatient = escapeHtml(patientName || 'Не вказано');
    const safeDate = escapeHtml(formattedDate);
    const safeTime = escapeHtml(formattedTime);

    await emailTransporter.sendMail({
      from: `"MindCare Platform" <${fromEmail}>`,
      to: psychologistEmail.trim(),
      subject: sanitizeEmailSubjectSegment(`Новий запис на сеанс - ${formattedDate} о ${formattedTime}`),
      html: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><h1>MindCare Platform</h1><p>Вітаємо, ${safePsych}!</p><p>У вас новий запис на сеанс.</p><p><strong>Пацієнт:</strong> ${safePatient}</p><p><strong>Дата та час:</strong> ${safeDate} о ${safeTime}</p><p>&copy; ${new Date().getFullYear()} MindCare Platform.</p></body></html>`,
      text: `Вітаємо, ${psychologistName || 'користувач'}!\n\nНовий запис на сеанс.\n\nПацієнт: ${patientName || 'Не вказано'}\nДата та час: ${formattedDate} о ${formattedTime}`,
    });
    console.log(`Appointment notification email sent to ${psychologistEmail}`);
    return true;
  } catch (error) {
    console.error(`Error sending appointment notification email to ${psychologistEmail}:`, error.message);
    return false;
  }
};

module.exports = {
  sendArticleNotification,
  notifyUsersAboutArticle,
  sendArticleRejectionNotification,
  sendAppointmentNotificationEmail,
};
