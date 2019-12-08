const express = require('express');
const Router = express.Router();
const config = require('config');
const stripe = require('stripe')(config.get('stripe_api_key'));
const nodemailer = require('nodemailer');

// Unsubscribe the client and send an email
Router.post('/unsubscribe', async (req, res) => {
  try {
    // Check if the email is inside the cleints list
    let customersList = await stripe.customers.list({ email: req.body.email });

    if (customersList.data === undefined || customersList.data.length == 0) {
      return res.status(404).json('Email Not Found');
    }

    // Get the exact Customer
    let [stripeCustomer] = customersList.data;

    // Retrieve the client's subscription
    const [subscription] = stripeCustomer.subscriptions.data;

    // Delete the subscrition
    await stripe.subscriptions.del(subscription.id);

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
      to: req.body.email, // list of receivers
      subject: '', // Subject line
      text: '', // content
      html: '' // html body
    };

    // send mail with defined transport object
    let info = await transporter.sendMail(mailOptions);

    res.send(`Email sent. message id: ${info.messageId}`);
  } catch (error) {
    console.error(error.message);
    res.status(402).send('Request Failed');
  }
});

Router.post('/add_paymentmethod', async (req, res) => {
  try {
    // Check if the email is inside the cleints list
    let customersList = await stripe.customers.list({ email: req.body.email });

    if (customersList.data === undefined || customersList.data.length == 0) {
      return res.status(404).json('Email Not Found');
    }

    // Get the exact Customer
    let [stripeCustomer] = customersList.data;

    // Create Payment Object
    const paymentObject = {
      type: req.body.payment_method_type,
      billing_details: {
        address: {
          city: req.body.city,
          country: req.body.country,
          line1: req.body.address_line1,
          line2: req.body.address_line2,
          postal_code: req.body.postal_code,
          state: req.body.state
        },
        email: req.body.email,
        name: req.body.name,
        phone: req.body.phone
      }
    };

    // Check the payment method type and add it to the payment object
    if (req.body.payment_method_type === 'card') {
      paymentObject.card = {
        number: req.body.card_number,
        exp_month: req.body.exp_month,
        exp_year: req.body.exp_year,
        cvc: req.body.cvc
      };
    } else if (req.body.payment_method_type === 'ideal') {
      paymentObject.ideal = {
        bank: req.body.bank
      };
    } else if (req.body.payment_method_type === 'sepa_debit') {
      paymentObject.sepa_debit = {
        iban: req.body.iban
      };
    } else {
      return res.status(400).send('Not Valid Payment Method Type');
    }

    // Create Payment Method
    const paymentMethod = await stripe.paymentMethods.create(paymentObject);

    // Add the Payment Method to the Customer
    const payMethodAttached = await stripe.paymentMethods.attach(
      paymentMethod.id,
      {
        customer: stripeCustomer.id
      }
    );

    // Set as default
    const updatedCustomer = await stripe.customers.update(stripeCustomer.id, {
      invoice_settings: {
        default_payment_method: payMethodAttached.id
      }
    });

    res.send(
      `New payment method added and set as default to the Customer: ${updatedCustomer.id}`
    );
  } catch (error) {
    console.error(error.message);
    res.status(402).send('Request Failed');
  }
});

module.exports = Router;
