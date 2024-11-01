const mongoose = require('mongoose');

const AppointmentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
    username: { type: String, required: false }, // Nome do usuário associado
    serviceType: { type: String, required: true },
    dateTime: { type: Date, required: true },
});

const Appointment = mongoose.model('Appointment', AppointmentSchema);
module.exports = Appointment;
