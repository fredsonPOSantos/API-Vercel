// /server/routes/appointments.js
// Importações
const express = require('express');
const router = express.Router();
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

require('dotenv').config(); // Certifique-se de carregar as variáveis de ambiente

const twilio = require('twilio');
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const sendWhatsAppMessage = (message) => {
    client.messages.create({
        from: process.env.TWILIO_PHONE_NUMBER,
        to: process.env.ADMIN_WHATSAPP_TO,
        body: message,
    }).then((msg) => {
        console.log('Mensagem enviada:', msg.sid);
    }).catch((err) => {
        console.error('Erro ao enviar mensagem via WhatsApp:', err);
    });
};

// Função para verificar se o usuário é administrador
const isAdmin = (user) => {
    return user.username === 'admin' || user.username === 'root';
};

// Rota para criar um agendamento
router.post('/', authMiddleware, async (req, res) => {
    const { serviceType, dateTime, username, author } = req.body;

    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'Usuário não encontrado' });

        if (!isAdmin(user)) {
            const existingAppointment = await Appointment.findOne({
                username: user.username, // Usando username
                dateTime: { $gte: new Date() }
            });

            if (existingAppointment) {
                return res.status(400).json({ message: 'Você já tem um agendamento futuro. Cancele ou remarque o atual antes de agendar outro.' });
            }
        }

        const appointment = new Appointment({
            username, // Usa o nome de usuário selecionado no frontend
            author: author || 'administrador', // Define o autor como "administrador"
            serviceType,
            dateTime,
            status: 'scheduled',
        });

        await appointment.save();
        const message = `Novo agendamento confirmado:\nUsuário: ${username}\nServiço: ${serviceType}\nData e Hora: ${new Date(dateTime).toLocaleString()}`;
        await sendWhatsAppMessage(message);
        res.status(201).json({ message: 'Agendamento criado com sucesso' });
    } catch (error) {
        console.error('Erro ao criar agendamento:', error);
        res.status(500).json({ message: 'Erro ao criar agendamento' });
    }
});
// Adicionando o método para converter o horário para UTC antes de enviar ao cliente
const convertToUTCString = (date) => {
    return new Date(date).toISOString();
};
// Rota para buscar todos os agendamentos (se admin) ou apenas os do usuário
router.get('/', authMiddleware, async (req, res) => {
    const { username } = req.query; // Obtém o nome de usuário da query string (se fornecido)

    try {
        const user = await User.findById(req.user.id);

        // Se o usuário for um administrador, retorna todos os agendamentos ou filtra por nome de usuário
        if (isAdmin(user)) {
            const appointments = username ? await Appointment.find({ username }) : await Appointment.find();
            return res.json(appointments);
        }

        // Se não for admin, retorna apenas os agendamentos do usuário
        const appointments = await Appointment.find({ 
            username: user.username, 
            dateTime: { $gte: new Date() } // Apenas agendamentos futuros
        });
         // Converte o horário para UTC para evitar diferenças de fuso horário
        const formattedAppointments = appointments.map(app => ({
            ...app.toObject(),
            dateTime: convertToUTCString(app.dateTime) // Convertendo a data para string UTC
        }));

        res.json(formattedAppointments);
    } catch (error) {
        console.error('Erro ao buscar agendamentos:', error);
        res.status(500).json({ message: 'Erro ao buscar agendamentos' });
    }
});
        
// Rota para buscar todos os usuários pelo campo 'username'
router.get('/users', async (req, res) => {
    try {
        const users = await User.find({}, 'username'); // Busca apenas o campo 'username'
        res.json(users);
    } catch (error) {
        console.error('Erro ao buscar usuários:', error);
        res.status(500).json({ message: 'Erro ao buscar usuários' });
    }
});

// Atualizar um agendamento
router.put('/:id', authMiddleware, async (req, res) => {
    const { serviceType, dateTime } = req.body;

    try {
        const appointment = await Appointment.findById(req.params.id);
        const user = await User.findById(req.user.id);

        if (!appointment) return res.status(404).json({ message: 'Agendamento não encontrado' });

        // Verifica se o usuário é administrador ou se o agendamento pertence ao usuário
        if (!isAdmin(user) && appointment.username !== user.username) {
            return res.status(403).json({ message: 'Acesso negado' });
        }

        // Atualiza o agendamento
        const updatedAppointment = await Appointment.findByIdAndUpdate(
            req.params.id,
            { serviceType, dateTime },
            { new: true }
        );

        // Enviar notificação via WhatsApp para o administrador
        const message = `O agendamento de ${user.username} foi remarcado:\nNovo Serviço: ${serviceType}\nNova Data e Hora: ${new Date(dateTime).toLocaleString()}`;
        await sendWhatsAppMessage(message);

        console.log('Agendamento atualizado:', updatedAppointment);
        res.json(updatedAppointment);
    } catch (error) {
        console.error('Erro ao atualizar agendamento:', error);
        res.status(500).json({ message: 'Erro ao atualizar agendamento' });
    }
});

// Cancelar um agendamento
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const appointment = await Appointment.findById(req.params.id);
        const user = await User.findById(req.user.id);

        if (!appointment) {
            return res.status(404).json({ message: 'Agendamento não encontrado' });
        }

        if (!isAdmin(user) && appointment.username !== user.username) {
            return res.status(403).json({ message: 'Acesso negado' });
        }

        await Appointment.findByIdAndDelete(req.params.id);

        const message = `O agendamento de ${user.username} para o serviço de ${appointment.serviceType} em ${new Date(appointment.dateTime).toLocaleString()} foi cancelado.`;
        await sendWhatsAppMessage(message);

        res.send('Agendamento cancelado');
    } catch (error) {
        console.error('Erro ao cancelar agendamento:', error);
        res.status(500).json({ message: 'Erro ao cancelar agendamento' });
    }
});

// Rota para obter os detalhes de um agendamento específico
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const appointment = await Appointment.findById(req.params.id);
        const user = await User.findById(req.user.id);

        if (!appointment) {
            return res.status(404).json({ message: 'Agendamento não encontrado' });
        }

        // Verifica se o usuário é administrador ou se o agendamento pertence ao usuário
        if (!isAdmin(user) && appointment.username !== user.username) {
            return res.status(403).json({ message: 'Acesso negado' });
        }

        res.json(appointment);
    } catch (error) {
        console.error('Erro ao buscar o agendamento:', error);
        res.status(500).json({ message: 'Erro ao buscar o agendamento' });
    }
});

module.exports = router;
