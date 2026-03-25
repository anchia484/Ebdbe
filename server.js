// server.js
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;
const SECRET_KEY = 'sua_chave_secreta_aqui'; // Em produção, use variáveis de ambiente

// Middlewares
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// Conexão MongoDB (Substitua pela sua URL do MongoDB Atlas ou Local)
mongoose.connect('mongodb+srv://santosborge484_db_user:uNWJuU9Wk7C15r3t@cluster0.yqbcfll.mongodb.net/?appName=Cluster0')
    .then(() => console.log('✅ Conectado ao MongoDB'))
    .catch(err => console.error('❌ Erro ao conectar:', err));

// --- MODELOS ---

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    bio: { type: String, default: "" },
    avatar: { type: String, default: "" }
});

const PostSchema = new mongoose.Schema({
    content: { type: String, required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Post = mongoose.model('Post', PostSchema);

// --- MIDDLEWARE DE AUTENTICAÇÃO ---

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Acesso negado' });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token inválido' });
        req.user = user;
        next();
    });
};

// --- ROTAS DE AUTENTICAÇÃO ---

app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ name, email, password: hashedPassword });
        await newUser.save();
        res.status(201).json({ message: 'Usuário criado com sucesso!' });
    } catch (error) {
        res.status(400).json({ error: 'Erro ao registrar usuário (Email já existe?)' });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Usuário não encontrado' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Senha incorreta' });

    const token = jwt.sign({ id: user._id, name: user.name }, SECRET_KEY, { expiresIn: '1h' });
    res.json({ token, userId: user._id });
});

// --- ROTAS DE POSTS ---

app.get('/api/posts', authenticateToken, async (req, res) => {
    const posts = await Post.find().populate('author', 'name avatar').sort({ createdAt: -1 });
    res.json(posts);
});

app.post('/api/posts', authenticateToken, async (req, res) => {
    try {
        const newPost = new Post({
            content: req.body.content,
            author: req.user.id
        });
        await newPost.save();
        const populatedPost = await Post.findById(newPost._id).populate('author', 'name avatar');
        res.status(201).json(populatedPost);
    } catch (error) {
        res.status(400).json({ error: 'Erro ao criar post' });
    }
});

// --- ROTAS DE PERFIL ---

app.get('/api/profile/:id', authenticateToken, async (req, res) => {
    const user = await User.findById(req.params.id).select('-password');
    const posts = await Post.find({ author: req.params.id }).sort({ createdAt: -1 });
    res.json({ user, posts });
});

app.put('/api/profile', authenticateToken, async (req, res) => {
    const { bio, avatar } = req.body;
    await User.findByIdAndUpdate(req.user.id, { bio, avatar });
    res.json({ message: 'Perfil atualizado!' });
});

app.listen(PORT, () => console.log(`🚀 Servidor rodando em http://localhost:${PORT}`));