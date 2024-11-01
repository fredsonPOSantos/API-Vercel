// /server/routes/reports.js
const express = require('express');
const Appointment = require('../models/Appointment');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Rota para obter análises de agendamentos
router.get('/analytics', authMiddleware, async (req, res) => {
    try {
        // Contar agendamentos por dia
        const dailyAppointments = await Appointment.aggregate([
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$dateTime" } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } } // Ordenar por data
        ]);

        // Obter os tipos de serviços mais populares
        const popularServices = await Appointment.aggregate([
            {
                $group: {
                    _id: "$serviceType",
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } }, // Ordenar por contagem
            { $limit: 5 } // Limitar aos 5 mais populares
        ]);

        res.json({ dailyAppointments, popularServices });
    } catch (error) {
        console.error('Erro ao obter análises:', error);
        res.status(500).json({ message: 'Erro ao obter análises' });
    }
});

// Rota para exportar dados para CSV
router.get('/export', authMiddleware, async (req, res) => {
    try {
        const appointments = await Appointment.find();
        // Formatar dados para CSV
        const csvData = appointments.map(app => ({
            id: app._id,
            username: app.username,
            serviceType: app.serviceType,
            dateTime: app.dateTime,
        }));

        const csvHeader = 'id,username,serviceType,dateTime\n';
        const csvRows = csvData.map(row => `${row.id},${row.username},${row.serviceType},${row.dateTime}`).join('\n');

        const csv = csvHeader + csvRows;

        res.header('Content-Type', 'text/csv');
        res.attachment('appointments.csv');
        res.send(csv);
    } catch (error) {
        console.error('Erro ao exportar dados:', error);
        res.status(500).json({ message: 'Erro ao exportar dados' });
    }
});

module.exports = router;
