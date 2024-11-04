// /server/routes/auth.js
const jwt = require('jsonwebtoken');
const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const router = express.Router();

// Rota para registrar um novo usuário
router.post('/register', async (req, res) => {
    const { username, email, password } = req.body;

    try {
        // Verifica se o usuário já existe
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Usuário já existe' });
        }

        // Verifica se a senha foi fornecida
        if (!password) {
            return res.status(400).json({ message: 'Senha é obrigatória' });
        }

        // Criptografando a senha
        const hashedPassword = await bcrypt.hash(password, 10);

        // Criando o novo usuário
        const newUser = new User({
            username,
            email,
            password: hashedPassword,
        });

        // Salvando o usuário no banco de dados
        await newUser.save();
        res.status(201).json({ message: 'Usuário registrado com sucesso!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro ao registrar usuário' });
    }
});

// Login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(400).json({ message: 'Usuario ou senha inválidas ou Não Cadastrado' });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '10m' });
    res.json({ token });
});

module.exports = router;
