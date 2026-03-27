const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
// O Render define a porta automaticamente na variável de ambiente PORT, caso contrário usa 10000
const PORT = process.env.PORT || 10000; 
const JWT_SECRET = 'sua_chave_secreta_aqui'; 

// Middlewares
app.use(express.json());
app.use(cors());

// --- CONEXÃO MONGODB ATLAS ---
// String com permissões de escrita e autenticação forçada no banco admin
const mongoURI = 'mongodb+srv://santosborge484_db_user:uNWJuU9Wk7C15r3t@cluster0.yqbcfll.mongodb.net/minirede_social?retryWrites=true&w=majority&authSource=admin';

mongoose.connect(mongoURI)
    .then(() => console.log('✅ Conectado ao MongoDB Atlas com sucesso!'))
    .catch(err => {
        console.error('❌ Erro de conexão:', err.message);
    });

// --- MODELS ---

const UserSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    senha: { type: String, required: true },
    foto: { type: String, default: 'https://cdn-icons-png.flaticon.com/512/149/149071.png' },
    criadoEm: { type: Date, default: Date.now }
});

const PostSchema = new mongoose.Schema({
    conteudo: { type: String, required: true },
    autor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    criadoEm: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Post = mongoose.model('Post', PostSchema);

// --- MIDDLEWARE DE AUTENTICAÇÃO ---

const authMiddleware = (req, res, next) => {
    const token = req.header('Authorization');
    if (!token) return res.status(401).json({ msg: 'Acesso negado. Token não fornecido.' });

    try {
        const decoded = jwt.verify(token.replace('Bearer ', ''), JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(400).json({ msg: 'Token inválido ou sessão expirada.' });
    }
};

// --- ROTAS DA API ---

// Registro de Usuário
app.post('/api/register', async (req, res) => {
    try {
        const { nome, email, senha } = req.body;
        
        let userExists = await User.findOne({ email });
        if (userExists) return res.status(400).json({ msg: 'E-mail já cadastrado.' });

        const salt = await bcrypt.genSalt(10);
        const senhaCripto = await bcrypt.hash(senha, salt);

        const newUser = new User({ nome, email, senha: senhaCripto });
        await newUser.save();

        res.status(201).json({ msg: 'Usuário registrado com sucesso!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    try {
        const { email, senha } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ msg: 'Usuário não encontrado.' });

        const isMatch = await bcrypt.compare(senha, user.senha);
        if (!isMatch) return res.status(400).json({ msg: 'Senha incorreta.' });

        const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '1d' });
        res.json({ token, user: { id: user._id, nome: user.nome } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Criar Post
app.post('/api/posts', authMiddleware, async (req, res) => {
    try {
        const newPost = new Post({
            conteudo: req.body.conteudo,
            autor: req.user.id
        });
        await newPost.save();
        res.status(201).json(newPost);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Listar Feed (Todos os posts)
app.get('/api/posts', async (req, res) => {
    try {
        const posts = await Post.find()
            .populate('autor', 'nome foto')
            .sort({ criadoEm: -1 });
        res.json(posts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Curtir/Descurtir Post
app.post('/api/posts/:id/like', authMiddleware, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ msg: 'Post não encontrado' });

        const index = post.likes.indexOf(req.user.id);
        if (index === -1) {
            post.likes.push(req.user.id);
        } else {
            post.likes.splice(index, 1);
        }

        await post.save();
        res.json(post);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Perfil do Usuário
app.get('/api/profile', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-senha');
        const userPosts = await Post.find({ autor: req.user.id }).sort({ criadoEm: -1 });
        res.json({ user, posts: userPosts });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
