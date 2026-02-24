import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// Cadastro de Usuário (Cliente ou Admin)
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, role } = req.body; // role: 'customer' ou 'admin'
  
  const hash = await bcrypt.hash(password, 10);
  
  try {
    await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, hash, role || 'customer']
    );
    res.status(201).json({ message: 'Usuário criado com sucesso' });
  } catch (err) {
    res.status(400).json({ error: 'E-mail já cadastrado' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
  const user = users[0];

  if (user && await bcrypt.compare(password, user.password_hash)) {
    const token = jwt.sign(
      { id: user.id, role: user.role }, 
      process.env.JWT_SECRET, 
      { expiresIn: '1d' }
    );
    res.json({ token, role: user.role, name: user.name });
  } else {
    res.status(401).json({ error: 'Credenciais inválidas' });
  }
});