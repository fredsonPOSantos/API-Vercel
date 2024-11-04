const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Certifique-se de importar o modelo de usuário

const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    
    // Verifica se o cabeçalho de autorização existe e se o formato é correto
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Acesso negado, token não fornecido.' });
    }

    const token = authHeader.split(' ')[1]; // Extrai o token após "Bearer "

    if (!token) {
        return res.status(401).json({ message: 'Acesso negado, token inválido.' });
    }

    try {
        // Verifica e decodifica o token JWT
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; 
        console.log('Decoded token:', decoded);
// Armazena os dados do token no objeto req

        // Busca o usuário no banco de dados usando o ID contido no token
        const user = await User.findById(req.user.id);

        // Verifica se o usuário existe no banco de dados
        if (!user) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }

        // Armazena o usuário completo no objeto req para uso futuro nas rotas
        req.user = user;

        next(); // Continua para a próxima função na rota
    } catch (err) {
        console.error('Erro de autenticação:', err);
        return res.status(400).json({ message: 'Token inválido.' });
    }
};

module.exports = authMiddleware;
