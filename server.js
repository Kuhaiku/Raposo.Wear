import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Configuração para servir o Frontend (HTML/CSS/JS)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, 'public')));

// 1. Configuração do Banco de Dados
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT, 
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// 2. Configuração do Mercado Pago
const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });

// 3. Rota para listar os produtos
app.get('/api/products', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM products WHERE stock > 0');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar produtos' });
  }
});

// 4. Rota para criar a preferência de pagamento
app.post('/api/create_preference', async (req, res) => {
  const { productId, quantity, customerEmail } = req.body;

  try {
    const [products] = await pool.query('SELECT * FROM products WHERE id = ?', [productId]);
    const product = products[0];

    if (!product) return res.status(404).json({ error: 'Produto não encontrado' });

    const preference = new Preference(client);
    const result = await preference.create({
      body: {
        items: [
          {
            id: product.id.toString(),
            title: product.name,
            quantity: quantity,
            unit_price: Number(product.price),
            currency_id: 'BRL',
          }
        ],
        payer: {
          email: customerEmail
        },
        back_urls: {
          success: `${process.env.FRONTEND_URL}?status=sucesso`,
          failure: `${process.env.FRONTEND_URL}?status=falha`,
          pending: `${process.env.FRONTEND_URL}?status=pendente`
        },
        auto_return: 'approved',
        notification_url: process.env.WEBHOOK_URL
      }
    });

    const total = product.price * quantity;
    await pool.query(
      'INSERT INTO orders (customer_email, total, mp_preference_id) VALUES (?, ?, ?)',
      [customerEmail, total, result.id]
    );

    res.json({ id: result.id, init_point: result.init_point });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar pagamento' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Estado zero rodando na porta ${PORT}`);
});