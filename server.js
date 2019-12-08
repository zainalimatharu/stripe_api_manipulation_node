const express = require('express');
const cron = require('node-cron');
const config = require('config');
const stripe = require('stripe')(config.get('stripe_api_key'));
const nodemailer = require('nodemailer');

const app = express();

// init middleware
app.use(express.json({ extended: false }));

cron.schedule(
  '0 1 * * *',
  async () => {
    let customersObject = await stripe.customers.list();

    let customersList = customersObject.data;

    customersList.forEach(async customer => {
      const customerSubscriptions = customer.subscriptions.data;

      let past_dueSubscriptions = [];

      customerSubscriptions.forEach(subscription => {
        if (subscription.status === 'past_due') {
          const subscription_id = subscription.id;
          const subscription_status = subscription.status;
          past_dueSubscriptions.push({
            subscription_id,
            subscription_status
          });
        }
      });

      console.log(past_dueSubscriptions);

      if (
        !past_dueSubscriptions === undefined ||
        past_dueSubscriptions.length > 0
      ) {
        // Send email
        // Create reusable transporter object using the default SMTP transport
        let transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: 'payments@teamtrade.es', // email
            pass: '' // password
          },
          tls: {
            rejectUnauthorized: false
          }
        });

        let mailOptions = {
          from: '"Your Name" <payments@teamtrade.es>', // sender address
          to: customer.email, // list of receivers
          subject: '', // Subject line
          text: '', // content
          html: '' // html body
        };

        // send mail with defined transport object
        await transporter.sendMail(mailOptions);
      }
    });
  },
  {
    scheduled: true,
    timezone: 'Europe/London'
  }
);

// Define Routes
app.use('/api/v1', require('./routes/api/index'));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server started on Port ${PORT}`));
