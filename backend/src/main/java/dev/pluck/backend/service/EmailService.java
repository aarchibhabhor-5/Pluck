package dev.pluck.backend.service;

import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username:}")
    private String mailUsername;

    @Value("${spring.mail.password:}")
    private String mailPassword;

    @Value("${spring.mail.host:smtp.gmail.com}")
    private String mailHost;

    @Value("${pluck.mail.from:notifications@pluck.dev}")
    private String mailFrom;

    @Value("${pluck.app.base-url:http://localhost:4000}")
    private String appBaseUrl;

    @Autowired
    public EmailService(@Autowired(required = false) JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    public boolean isSmtpConfigured() {
        return mailUsername != null && !mailUsername.trim().isEmpty() &&
               mailPassword != null && !mailPassword.trim().isEmpty();
    }

    /**
     * Dispatches team workspace invitation email (PRD §2.6.2 & §M4.1)
     */
    public Map<String, Object> sendTeamInviteEmail(
            String recipientEmail,
            String teamName,
            String inviterName,
            String role,
            String rawToken
    ) {
        String inviteUrl = appBaseUrl + "/auth.html?invite=" + rawToken;
        Map<String, Object> result = new HashMap<>();
        result.put("inviteUrl", inviteUrl);
        result.put("recipient", recipientEmail);

        if (!isSmtpConfigured()) {
            log.info("\n================================================================================" +
                    "\n[PLUCK EMAIL SERVICE — SIMULATED DELIVERY]" +
                    "\nTo: " + recipientEmail +
                    "\nInvited by: " + inviterName + " to workspace: '" + teamName + "' as " + role +
                    "\nInvite URL: " + inviteUrl +
                    "\nNOTE: Real SMTP credentials (SPRING_MAIL_USERNAME & SPRING_MAIL_PASSWORD) are not set." +
                    "\nConfigure them in application.properties or environment to send live emails." +
                    "\n================================================================================");
            result.put("delivered", false);
            result.put("reason", "SMTP_NOT_CONFIGURED");
            result.put("message", "SMTP credentials not configured. Set SPRING_MAIL_USERNAME and SPRING_MAIL_PASSWORD to deliver real emails.");
            return result;
        }

        try {
            if (mailSender == null) {
                result.put("delivered", false);
                result.put("reason", "MAIL_SENDER_UNAVAILABLE");
                return result;
            }

            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            String senderAddress = (mailUsername != null && mailUsername.contains("@")) ? mailUsername : mailFrom;
            helper.setFrom(senderAddress, "Pluck Workspace");
            helper.setTo(recipientEmail);
            helper.setSubject("You're invited to join " + teamName + " on Pluck");

            String html = generateInviteHtml(recipientEmail, teamName, inviterName, role, inviteUrl);
            helper.setText(html, true);

            mailSender.send(message);
            log.info("[EmailService] Real invite email dispatched successfully to {} for team {}", recipientEmail, teamName);
            result.put("delivered", true);
            result.put("message", "Invitation email sent to " + recipientEmail);
            return result;
        } catch (Exception e) {
            log.error("[EmailService] Failed to dispatch email to {}: {}", recipientEmail, e.getMessage());
            result.put("delivered", false);
            result.put("reason", "SMTP_SEND_ERROR");
            result.put("error", e.getMessage());
            return result;
        }
    }

    /**
     * Dispatches password reset email with secure recovery link
     */
    public Map<String, Object> sendPasswordResetEmail(String recipientEmail, String resetToken) {
        String resetUrl = appBaseUrl + "/auth.html?reset=" + resetToken;
        Map<String, Object> result = new HashMap<>();
        result.put("resetUrl", resetUrl);
        result.put("recipient", recipientEmail);

        if (!isSmtpConfigured()) {
            log.info("\n================================================================================" +
                    "\n[PLUCK EMAIL SERVICE — SIMULATED PASSWORD RESET]" +
                    "\nTo: " + recipientEmail +
                    "\nReset URL: " + resetUrl +
                    "\nNOTE: Real SMTP credentials (SPRING_MAIL_USERNAME & SPRING_MAIL_PASSWORD) are not set." +
                    "\nConfigure them in application.properties or environment to send live emails." +
                    "\n================================================================================");
            result.put("delivered", false);
            result.put("reason", "SMTP_NOT_CONFIGURED");
            result.put("message", "SMTP credentials not configured. Use the generated reset link below.");
            return result;
        }

        try {
            if (mailSender == null) {
                result.put("delivered", false);
                result.put("reason", "MAIL_SENDER_UNAVAILABLE");
                return result;
            }

            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            String senderAddress = (mailUsername != null && mailUsername.contains("@")) ? mailUsername : mailFrom;
            helper.setFrom(senderAddress, "Pluck Security");
            helper.setTo(recipientEmail);
            helper.setSubject("Reset your Pluck account password");

            String html = generateResetPasswordHtml(recipientEmail, resetUrl);
            helper.setText(html, true);

            mailSender.send(message);
            log.info("[EmailService] Password reset email sent successfully to {}", recipientEmail);
            result.put("delivered", true);
            result.put("message", "Password reset email sent to " + recipientEmail);
            return result;
        } catch (Exception e) {
            log.error("[EmailService] Failed to dispatch password reset email to {}: {}", recipientEmail, e.getMessage());
            result.put("delivered", false);
            result.put("reason", "SMTP_SEND_ERROR");
            result.put("error", e.getMessage());
            return result;
        }
    }

    private String generateResetPasswordHtml(String email, String resetUrl) {
        return "<!DOCTYPE html>" +
                "<html>" +
                "<head><meta charset='UTF-8'></head>" +
                "<body style='background-color: #0c0c0e; color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, monospace; margin: 0; padding: 32px 16px;'>" +
                "  <div style='max-width: 540px; margin: 0 auto; background: #141417; border: 1px solid #38bdf8; border-radius: 8px; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.6);'>" +
                "    <div style='display: flex; align-items: center; gap: 10px; margin-bottom: 24px; border-bottom: 1px solid rgba(56,189,248,0.25); padding-bottom: 16px;'>" +
                "      <span style='font-size: 24px;'>🦑</span>" +
                "      <span style='font-size: 18px; font-weight: 700; color: #38bdf8; letter-spacing: 1px;'>PLUCK SECURITY</span>" +
                "    </div>" +
                "    <h2 style='font-size: 20px; font-weight: 700; color: #ffffff; margin-top: 0; margin-bottom: 12px;'>Password Reset Request</h2>" +
                "    <p style='font-size: 14px; line-height: 1.6; color: #a1a1aa; margin-bottom: 20px;'>" +
                "      We received a request to reset the password for your Pluck account (<strong style='color: #ffffff;'>" + email + "</strong>)." +
                "    </p>" +
                "    <div style='text-align: center; margin: 32px 0;'>" +
                "      <a href='" + resetUrl + "' style='display: inline-block; background: #0284c7; color: #ffffff; font-weight: 700; font-size: 14px; text-decoration: none; padding: 12px 28px; border-radius: 6px; box-shadow: 0 4px 14px rgba(2,132,199,0.4);'>" +
                "        Reset My Password &rarr;" +
                "      </a>" +
                "    </div>" +
                "    <div style='background: #09090b; border: 1px dashed rgba(255,255,255,0.1); border-radius: 4px; padding: 12px; margin-bottom: 24px; word-break: break-all; font-size: 11px; color: #a1a1aa;'>" +
                "      If the button above does not work, copy and paste this link into your browser: <br/>" +
                "      <a href='" + resetUrl + "' style='color: #38bdf8; text-decoration: underline;'>" + resetUrl + "</a>" +
                "    </div>" +
                "    <div style='border-top: 1px solid rgba(255,255,255,0.08); padding-top: 16px; font-size: 11px; color: #52525b; line-height: 1.5;'>" +
                "      🔒 If you did not request a password reset, you can safely ignore this email. This link expires in 1 hour." +
                "    </div>" +
                "  </div>" +
                "</body>" +
                "</html>";
    }

    private String generateInviteHtml(String email, String teamName, String inviter, String role, String inviteUrl) {
        return "<!DOCTYPE html>" +
                "<html>" +
                "<head><meta charset='UTF-8'></head>" +
                "<body style='background-color: #0c0c0e; color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, monospace; margin: 0; padding: 32px 16px;'>" +
                "  <div style='max-width: 540px; margin: 0 auto; background: #141417; border: 1px solid #7c3aed; border-radius: 8px; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.6);'>" +
                "    <div style='display: flex; align-items: center; gap: 10px; margin-bottom: 24px; border-bottom: 1px solid rgba(124,58,237,0.25); padding-bottom: 16px;'>" +
                "      <span style='font-size: 24px;'>🦑</span>" +
                "      <span style='font-size: 18px; font-weight: 700; color: #c084fc; letter-spacing: 1px;'>PLUCK</span>" +
                "    </div>" +
                "    <h2 style='font-size: 20px; font-weight: 700; color: #ffffff; margin-top: 0; margin-bottom: 12px;'>You've been invited!</h2>" +
                "    <p style='font-size: 14px; line-height: 1.6; color: #a1a1aa; margin-bottom: 16px;'>" +
                "      <strong style='color: #ffffff;'>" + inviter + "</strong> has invited you to collaborate on the " +
                "      <strong style='color: #c084fc;'>" + teamName + "</strong> workspace as a " +
                "      <span style='background: rgba(124,58,237,0.2); border: 1px solid #7c3aed; color: #c084fc; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;'>" + role + "</span>." +
                "    </p>" +
                "    <p style='font-size: 13px; line-height: 1.6; color: #71717a; margin-bottom: 28px;'>" +
                "      Pluck is the local-first developer snippet vault with cryptographic AST verification, strict secret redaction, and instant CLI synchronization." +
                "    </p>" +
                "    <div style='text-align: center; margin: 32px 0;'>" +
                "      <a href='" + inviteUrl + "' style='display: inline-block; background: #7c3aed; color: #ffffff; font-weight: 700; font-size: 14px; text-decoration: none; padding: 12px 28px; border-radius: 6px; box-shadow: 0 4px 14px rgba(124,58,237,0.4);'>" +
                "        Accept Invitation &rarr;" +
                "      </a>" +
                "    </div>" +
                "    <div style='background: #09090b; border: 1px dashed rgba(255,255,255,0.1); border-radius: 4px; padding: 12px; margin-bottom: 24px; word-break: break-all; font-size: 11px; color: #a1a1aa;'>" +
                "      Or paste this link in your browser: <br/>" +
                "      <a href='" + inviteUrl + "' style='color: #c084fc; text-decoration: underline;'>" + inviteUrl + "</a>" +
                "    </div>" +
                "    <div style='border-top: 1px solid rgba(255,255,255,0.08); padding-top: 16px; font-size: 11px; color: #52525b; line-height: 1.5;'>" +
                "      🔒 Security Notice: Per Pluck workspace policy, this invitation link expires in 7 days." +
                "    </div>" +
                "  </div>" +
                "</body>" +
                "</html>";
    }
}
