const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const generateReceiptPDF = async (orderData) => {
  try {
    // Create HTML template for the receipt
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Order Receipt #${orderData.orderinfo_id}</title>
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
          
          .receipt-container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
            border-radius: 8px;
            overflow: hidden;
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
          
          .order-info {
            padding: 30px;
            border-bottom: 1px solid #eee;
          }
          
          .order-details {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 20px;
          }
          
          .detail-group {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 6px;
          }
          
          .detail-group h3 {
            color: #667eea;
            margin-bottom: 8px;
            font-size: 0.9em;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          
          .detail-group p {
            font-size: 1.1em;
            font-weight: 500;
          }
          
          .items-section {
            padding: 30px;
            border-bottom: 1px solid #eee;
          }
          
          .items-section h2 {
            color: #333;
            margin-bottom: 20px;
            font-size: 1.5em;
          }
          
          .item {
            display: grid;
            grid-template-columns: 2fr 1fr 1fr 1fr;
            gap: 15px;
            padding: 15px 0;
            border-bottom: 1px solid #eee;
            align-items: center;
          }
          
          .item:last-child {
            border-bottom: none;
          }
          
          .item-header {
            font-weight: 600;
            color: #667eea;
            text-transform: uppercase;
            font-size: 0.8em;
            letter-spacing: 1px;
          }
          
          .item-name {
            font-weight: 500;
          }
          
          .item-price, .item-quantity, .item-total {
            text-align: center;
            font-weight: 500;
          }
          
          .total-section {
            padding: 30px;
            background: #f8f9fa;
          }
          
          .total-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 0;
            font-size: 1.1em;
          }
          
          .total-row.grand-total {
            border-top: 2px solid #667eea;
            margin-top: 15px;
            padding-top: 20px;
            font-size: 1.3em;
            font-weight: 600;
            color: #667eea;
          }
          
          .footer {
            padding: 20px 30px;
            text-align: center;
            background: #333;
            color: white;
          }
          
          .footer p {
            margin-bottom: 5px;
          }
          
          .status-badge {
            display: inline-block;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 0.9em;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          
          .status-pending { background: #fff3cd; color: #856404; }
          .status-processing { background: #cce5ff; color: #004085; }
          .status-shipped { background: #d1ecf1; color: #0c5460; }
          .status-delivered { background: #d4edda; color: #155724; }
          .status-cancelled { background: #f8d7da; color: #721c24; }
        </style>
      </head>
      <body>
        <div class="receipt-container">
          <div class="header">
            <h1>LenSheem</h1>
            <p>Your Fashion Destination</p>
          </div>
          
          <div class="order-info">
            <div class="order-details">
              <div class="detail-group">
                <h3>Order Number</h3>
                <p>#${orderData.orderinfo_id}</p>
              </div>
              <div class="detail-group">
                <h3>Order Date</h3>
                <p>${new Date(orderData.date_placed).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</p>
              </div>
              <div class="detail-group">
                <h3>Order Status</h3>
                <p><span class="status-badge status-${orderData.status.toLowerCase()}">${orderData.status}</span></p>
              </div>
              <div class="detail-group">
                <h3>Shipping Region</h3>
                <p>${orderData.region}</p>
              </div>
            </div>
          </div>
          
          <div class="items-section">
            <h2>Order Items</h2>
            <div class="item item-header">
              <div>Item</div>
              <div>Price</div>
              <div>Quantity</div>
              <div>Total</div>
            </div>
            ${orderData.items.map(item => `
              <div class="item">
                <div class="item-name">${item.item_name}</div>
                <div class="item-price">$${parseFloat(item.price).toFixed(2)}</div>
                <div class="item-quantity">${item.quantity}</div>
                <div class="item-total">$${(parseFloat(item.price) * item.quantity).toFixed(2)}</div>
              </div>
            `).join('')}
          </div>
          
          <div class="total-section">
            <div class="total-row">
              <span>Subtotal:</span>
              <span>$${orderData.items.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0).toFixed(2)}</span>
            </div>
            <div class="total-row">
              <span>Shipping:</span>
              <span>$${parseFloat(orderData.rate).toFixed(2)}</span>
            </div>
            <div class="total-row grand-total">
              <span>Total:</span>
              <span>$${(orderData.items.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0) + parseFloat(orderData.rate)).toFixed(2)}</span>
            </div>
          </div>
          
          <div class="footer">
            <p>Thank you for shopping with LenSheem!</p>
            <p>For any questions, please contact our support team</p>
            <p>© 2025 LenSheem. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Launch browser
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    // Set content and wait for rendering
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '20px',
        left: '20px'
      }
    });

    await browser.close();

    return pdfBuffer;
  } catch (error) {
    throw error;
  }
};

module.exports = { generateReceiptPDF }; 