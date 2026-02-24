import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
// 1. Configuração do Banco de Dados
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT, // Porta externa adicionada aqui
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// 2. Configuração do Mercado Pago (Substitua pelo seu Access Token)
const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });

// 3. Rota para listar os produtos na interface
app.get('/api/products', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM products WHERE stock > 0');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar produtos' });
  }
});

// 4. Rota para criar a preferência de pagamento (Checkout)
app.post('/api/create_preference', async (req, res) => {
  const { productId, quantity, customerEmail } = req.body;

  try {
    // Busca o produto no banco
    const [products] = await pool.query('SELECT * FROM products WHERE id = ?', [productId]);
    const product = products[0];

    if (!product) return res.status(404).json({ error: 'Produto não encontrado' });

    // Cria a preferência no Mercado Pago
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
          success: 'http://seusite.com/sucesso',
          failure: 'http://seusite.com/falha',
          pending: 'http://seusite.com/pendente'
        },
        auto_return: 'approved',
        notification_url: 'https://seusite.com/api/webhook' // Essencial para receber o status real
      }
    });

    // Registra o pedido como pendente no banco
    const total = product.price * quantity;
    await pool.query(
      'INSERT INTO orders (customer_email, total, mp_preference_id) VALUES (?, ?, ?)',
      [customerEmail, total, result.id]
    );

    // Retorna o ID e a URL de pagamento para o frontend
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