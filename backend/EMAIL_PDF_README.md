# Email and PDF Receipt System - LenSheem

## Overview
This system provides enhanced email notifications with professional HTML templates and PDF receipts for order confirmations and status updates.

## Features

### 🎨 Professional Email Templates
- **Modern Design**: Clean, responsive HTML email templates
- **Brand Consistency**: LenSheem branding with gradient headers
- **Status Badges**: Color-coded order status indicators
- **Mobile Responsive**: Optimized for all device sizes

### 📄 PDF Receipt Generation
- **Detailed Receipts**: Complete order information with itemized breakdown
- **Professional Layout**: Clean, print-ready PDF format
- **Automatic Generation**: PDFs are generated and attached automatically
- **Order Details**: Includes order number, date, status, shipping info, and totals

## Email Types

### 1. Order Status Updates
- **Trigger**: When order status changes (Pending → Processing → Shipped → Delivered)
- **Content**: Status update notification with order details
- **Attachment**: PDF receipt with complete order information

### 2. Order Confirmations
- **Trigger**: When a new order is created
- **Content**: Order confirmation with order details
- **Attachment**: PDF receipt with complete order information

## Technical Implementation

### Dependencies
```json
{
  "puppeteer": "^latest",
  "nodemailer": "^7.0.3"
}
```

### Key Files
- `utils/sendEmail.js` - Email sending utility with HTML templates
- `utils/generateReceipt.js` - PDF receipt generation
- `controllers/order.js` - Updated with email integration

### Email Template Features
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Professional Styling**: Modern CSS with gradients and shadows
- **Status Indicators**: Color-coded badges for different order statuses
- **Call-to-Action**: Buttons for viewing order details
- **Social Links**: Footer with social media links

### PDF Receipt Features
- **Complete Order Info**: Order number, date, status, shipping details
- **Itemized List**: Product names, prices, quantities, and totals
- **Professional Layout**: Clean, organized design
- **Print Ready**: Optimized for printing and archiving

## Usage

### Sending Order Status Update Email
```javascript
await sendEmail({
  email: 'customer@example.com',
  subject: `Your Order #${orderId} Status Updated`,
  type: 'orderStatus',
  data: {
    name: 'Customer Name',
    orderId: orderId,
    newStatus: 'Delivered'
  },
  attachReceipt: true,
  orderData: orderData
});
```

### Sending Order Confirmation Email
```javascript
await sendEmail({
  email: 'customer@example.com',
  subject: `Order Confirmation #${orderId} - LenSheem`,
  type: 'orderStatus',
  data: {
    name: 'Customer Name',
    orderId: orderId,
    newStatus: 'Pending'
  },
  attachReceipt: true,
  orderData: orderData
});
```

## Testing

### Test Endpoint
Use the test endpoint to verify email and PDF functionality:
```
POST /api/orders/test-email
```

This will send a test email with a sample PDF receipt to verify the system is working correctly.

### Manual Testing
1. Create a new order through the API
2. Update order status through the admin panel
3. Check Mailtrap for received emails
4. Verify PDF attachments are included

## Configuration

### Mailtrap Settings
The system is configured to use Mailtrap for email testing:
- **Host**: sandbox.smtp.mailtrap.io
- **Port**: 2525
- **Authentication**: Username and password from Mailtrap

### PDF Generation
- **Format**: A4
- **Margins**: 20px on all sides
- **Background**: Print background enabled
- **Browser**: Headless Chrome via Puppeteer

## Error Handling

### Email Failures
- Email sending failures don't affect order processing
- Errors are logged for debugging
- Graceful fallback when email service is unavailable

### PDF Generation Failures
- PDF generation failures don't prevent email sending
- Emails are sent without attachments if PDF generation fails
- Errors are logged for debugging

## Future Enhancements

### Planned Features
- **Email Templates**: More email types (welcome, password reset, etc.)
- **Customization**: Admin-configurable email templates
- **Analytics**: Email open and click tracking
- **Localization**: Multi-language email support
- **Branding**: Customizable colors and logos

### Technical Improvements
- **Caching**: PDF generation caching for performance
- **Queue System**: Background email processing
- **Retry Logic**: Automatic retry for failed emails
- **Monitoring**: Email delivery monitoring and alerts

## Troubleshooting

### Common Issues

1. **PDF Generation Fails**
   - Check Puppeteer installation
   - Verify system has enough memory
   - Check browser launch arguments

2. **Email Not Sending**
   - Verify Mailtrap credentials
   - Check network connectivity
   - Review email service logs

3. **Template Rendering Issues**
   - Test email templates in different email clients
   - Verify CSS compatibility
   - Check HTML structure

### Debug Mode
Enable detailed logging by setting environment variables:
```bash
DEBUG_EMAIL=true
DEBUG_PDF=true
```

## Support

For technical support or questions about the email and PDF system, please refer to the main project documentation or contact the development team. 