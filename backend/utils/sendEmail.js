const nodemailer = require("nodemailer");
const { generateReceiptPDF } = require('./generateReceipt');

const createEmailTemplate = (type, data) => {
  const baseTemplate = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>LenSheem - ${type}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          background-color: #f8f9fa;
        }
        
        .email-container {
          max-width: 600px;
          margin: 0 auto;
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 0 20px rgba(0,0,0,0.1);
        }
        
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px;
          text-align: center;
        }
        
        .header h1 {
          font-size: 2.5em;
          margin-bottom: 10px;
          font-weight: 300;
        }
        
        .header p {
          font-size: 1.1em;
          opacity: 0.9;
        }
        
        .content {
          padding: 40px 30px;
        }
        
        .greeting {
          font-size: 1.3em;
          margin-bottom: 20px;
          color: #333;
        }
        
        .message {
          font-size: 1.1em;
          line-height: 1.8;
          margin-bottom: 30px;
          color: #555;
        }
        
        .order-details {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
          border-left: 4px solid #667eea;
        }
        
        .order-number {
          font-size: 1.2em;
          font-weight: 600;
          color: #667eea;
          margin-bottom: 10px;
        }
        
        .status-badge {
          display: inline-block;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 0.9em;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin: 10px 0;
        }
        
        .status-pending { background: #fff3cd; color: #856404; }
        .status-processing { background: #cce5ff; color: #004085; }
        .status-shipped { background: #d1ecf1; color: #0c5460; }
        .status-delivered { background: #d4edda; color: #155724; }
        .status-cancelled { background: #f8d7da; color: #721c24; }
        
        .cta-button {
          display: inline-block;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 15px 30px;
          text-decoration: none;
          border-radius: 25px;
          font-weight: 600;
          margin: 20px 0;
          transition: transform 0.3s ease;
        }
        
        .cta-button:hover {
          transform: translateY(-2px);
        }
        
        .footer {
          background: #333;
          color: white;
          padding: 30px;
          text-align: center;
        }
        
        .footer p {
          margin-bottom: 10px;
        }
        
        .social-links {
          margin-top: 20px;
        }
        
        .social-links a {
          color: white;
          margin: 0 10px;
          text-decoration: none;
        }
        
        .receipt-note {
          background: #e3f2fd;
          border: 1px solid #2196f3;
          padding: 15px;
          border-radius: 6px;
          margin: 20px 0;
          color: #1565c0;
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="header">
          <h1>LenSheem</h1>
          <p>Your Fashion Destination</p>
        </div>
        
        <div class="content">
          <div class="greeting">Hi ${data.name || 'Valued Customer'},</div>
          
          ${type === 'orderStatus' ? `
            <div class="message">
              Your order status has been updated! We're excited to keep you informed about your purchase.
            </div>
            
            <div class="order-details">
              <div class="order-number">Order #${data.orderId}</div>
              <div class="status-badge status-${data.newStatus.toLowerCase()}">${data.newStatus}</div>
              <p><strong>Updated on:</strong> ${new Date().toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}</p>
            </div>
            
            <div class="receipt-note">
              📄 <strong>Receipt Attached:</strong> You'll find a detailed PDF receipt attached to this email with all your order information.
            </div>
            
            <p class="message">
              Thank you for choosing LenSheem for your fashion needs. We're committed to providing you with the best shopping experience!
            </p>
            
            <a href="#" class="cta-button">View Order Details</a>
          ` : `
            <div class="message">
              ${data.message || 'Thank you for your interest in LenSheem!'}
            </div>
          `}
        </div>
        
        <div class="footer">
          <p>Thank you for shopping with LenSheem!</p>
          <p>For any questions, please contact our support team</p>
          <div class="social-links">
            <a href="#">Facebook</a> |
            <a href="#">Instagram</a> |
            <a href="#">Twitter</a>
          </div>
          <p style="margin-top: 20px; font-size: 0.9em; opacity: 0.8;">
            © 2025 LenSheem. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return baseTemplate;
};

const sendEmail = async ({ email, subject, message, type = 'general', data = {}, attachReceipt = false, orderData = null }) => {
  try {
    // Create the transporter using Mailtrap SMTP credentials
    const transporter = nodemailer.createTransport({
      host: "sandbox.smtp.mailtrap.io",
      port: 2525,
      auth: {
        user: "38515dfa92f3a2", // replace with your actual Mailtrap user
        pass: "48bac8666c1829"  // replace with your actual Mailtrap password
      }
    });

    // Generate HTML content based on type
    const htmlContent = type === 'orderStatus' ? 
      createEmailTemplate('orderStatus', data) : 
      message;

    // Prepare mail options
    const mailOptions = {
      from: "LenSheem <no-reply@lensheem.com>",
      to: email,
      subject: subject,
      html: htmlContent
    };

    // Add PDF attachment if requested
    if (attachReceipt && orderData) {
      try {
        const pdfBuffer = await generateReceiptPDF(orderData);
        mailOptions.attachments = [{
          filename: `receipt-order-${orderData.orderinfo_id}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }];
      } catch (pdfError) {
        // Continue without PDF attachment
      }
    }

    // Send the email
    const info = await transporter.sendMail(mailOptions);

    return true;
  } catch (error) {
    throw error;
  }
};

module.exports = sendEmail;