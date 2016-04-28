var nodemailer = require('nodemailer');
var smtpTransport = require('nodemailer-smtp-transport');
var mailConfig = require('../../mail.json');

// Where options defines connection data
var options = {
    port: mailConfig.port,
    host: mailConfig.host,
    auth: {
        user: mailConfig.mail,
        pass: mailConfig.password
    }
}

// To send e-mails you need a transporter object
// var transporter = nodemailer.createTransport(options[, defaults])
var transporter = nodemailer.createTransport(smtpTransport(options));

// var mailOptions = {
//     from: '"Stevia " <' + mailConfig.mail + '>', // sender address
//     to: 'mermegar@gmail.com', // list of receivers
//     subject: 'Hello ✔', // Subject line
//     text: 'Hello world 🐴', // plaintext body
//     html: '<b>Hello world 🐴</b>' // html body
// };

// send mail with defined transport object
// transporter.sendMail(data[, callback])

module.exports = {
    send: function (options, callback) {
        options.from = '"' + mailConfig.name + '" <' + mailConfig.mail + '>'; // sender address
        transporter.sendMail(options, callback)
    },
};
