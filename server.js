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

const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });

// 2. Rota para listar os produtos
app.get('/api/products', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM products WHERE stock > 0');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar produtos' });
  }
});

// 3. Rota para criar a preferência de pagamento (Agora aceita Múltiplos Itens)
app.post('/api/create_preference', async (req, res) => {
  const { cartItems, customerEmail } = req.body; // cartItems = [{ id, quantity }]

  if (!cartItems || cartItems.length === 0) {
    return res.status(400).json({ error: 'Carrinho vazio' });
  }

  try {
    // Extrai apenas os IDs para buscar no banco
    const productIds = cartItems.map(item => item.id);
    
    // Busca os produtos originais no banco para garantir os preços reais
    const [products] = await pool.query('SELECT * FROM products WHERE id IN (?)', [productIds]);

    if (products.length === 0) return res.status(404).json({ error: 'Produtos não encontrados' });

    let totalOrder = 0;
    
    // Monta o array de itens no formato que o Mercado Pago exige
    const mpItems = cartItems.map(cartItem => {
      const dbProduct = products.find(p => p.id === cartItem.id);
      if (!dbProduct) throw new Error(`Produto ${cartItem.id} inválido`);

      totalOrder += dbProduct.price * cartItem.quantity;

      return {
        id: dbProduct.id.toString(),
        title: dbProduct.name,
        quantity: cartItem.quantity,
        unit_price: Number(dbProduct.price),
        currency_id: 'BRL',
      };
    });

    const preference = new Preference(client);
    const result = await preference.create({
      body: {
        items: mpItems,
        payer: { email: customerEmail },
        back_urls: {
          success: `${process.env.FRONTEND_URL}?status=sucesso`,
          failure: `${process.env.FRONTEND_URL}?status=falha`,
          pending: `${process.env.FRONTEND_URL}?status=pendente`
        },
        auto_return: 'approved',
        notification_url: process.env.WEBHOOK_URL
      }
    });

    // Registra o pedido no banco com o valor total calculado
    await pool.query(
      'INSERT INTO orders (customer_email, total, mp_preference_id) VALUES (?, ?, ?)',
      [customerEmail, totalOrder, result.id]
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